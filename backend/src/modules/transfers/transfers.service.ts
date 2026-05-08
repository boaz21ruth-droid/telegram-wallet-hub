import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WalletAccountStatus } from "@prisma/client";

import { PrismaService } from "../../common/prisma/prisma.service";
import { TelegramNotificationService } from "../../common/telegram/telegram-notification.service";
import { parsePositiveDecimal } from "../../common/utils/decimal.util";
import { LedgerService } from "../ledger/ledger.service";

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  async createTransfer(
    fromUserId: string,
    fromTelegramUserId: string,
    dto: {
      recipientTelegramUserId?: string;
      recipientAddress?: string;
      assetCode: string;
      network: string;
      amount: string;
      bizNo: string;
      note?: string;
    },
  ) {
    const amount = parsePositiveDecimal(dto.amount);

    if (dto.bizNo.trim().length === 0) {
      throw new BadRequestException("bizNo is required");
    }

    try {
      // Check idempotency before the full transaction — early return skips notifications
      const existingOrder = await this.prisma.transferOrder.findUnique({
        where: { fromUserId_bizNo: { fromUserId, bizNo: dto.bizNo } },
      });
      if (existingOrder) return existingOrder;

      const result = await this.prisma.$transaction(async (tx) => {
        const recipientTelegramUserId = dto.recipientTelegramUserId?.trim();
        const recipientAddress = dto.recipientAddress?.trim();
        let recipient = null;

        if (recipientAddress) {
          const addressRecord = await tx.walletAddress.findFirst({
            where: {
              address: recipientAddress,
              walletAccount: {
                assetCode: dto.assetCode,
                network: dto.network,
              },
            },
            include: {
              walletAccount: {
                include: {
                  user: true,
                },
              },
            },
          });

          if (!addressRecord) {
            throw new NotFoundException("Recipient address is not an internal wallet address");
          }

          recipient = addressRecord.walletAccount.user;
        } else if (recipientTelegramUserId) {
          recipient = await tx.user.findUnique({
            where: {
              telegramUserId: recipientTelegramUserId,
            },
          });
        }

        if (!recipient) {
          throw new NotFoundException("Recipient user does not exist");
        }

        if (recipient.id === fromUserId) {
          throw new BadRequestException("Cannot transfer to yourself");
        }

        const senderAccount = await tx.walletAccount.findUnique({
          where: {
            userId_assetCode_network: {
              userId: fromUserId,
              assetCode: dto.assetCode,
              network: dto.network,
            },
          },
        });

        const recipientAccount = await tx.walletAccount.findUnique({
          where: {
            userId_assetCode_network: {
              userId: recipient.id,
              assetCode: dto.assetCode,
              network: dto.network,
            },
          },
        });

        if (!senderAccount || !recipientAccount) {
          throw new NotFoundException("Wallet account does not exist for the selected asset");
        }

        if (senderAccount.status !== WalletAccountStatus.ACTIVE || recipientAccount.status !== WalletAccountStatus.ACTIVE) {
          throw new BadRequestException("Wallet account is not active");
        }

        const senderUpdate = await tx.walletAccount.updateMany({
          where: {
            id: senderAccount.id,
            availableBalance: {
              gte: amount,
            },
          },
          data: {
            availableBalance: {
              decrement: amount,
            },
          },
        });

        if (senderUpdate.count !== 1) {
          throw new BadRequestException("Insufficient available balance");
        }

        await tx.walletAccount.update({
          where: {
            id: recipientAccount.id,
          },
          data: {
            availableBalance: {
              increment: amount,
            },
          },
        });

        const transferOrder = await tx.transferOrder.create({
          data: {
            fromUserId,
            toUserId: recipient.id,
            assetCode: dto.assetCode,
            network: dto.network,
            amount,
            bizNo: dto.bizNo,
            note: dto.note,
          },
        });

        const journal = await this.ledgerService.recordTransfer(tx, {
          referenceId: transferOrder.id,
          fromWalletAccountId: senderAccount.id,
          toWalletAccountId: recipientAccount.id,
          assetCode: dto.assetCode,
          network: dto.network,
          amount,
          description: dto.note,
        });

        return tx.transferOrder.update({
          where: { id: transferOrder.id },
          data: { journalId: journal.id },
          include: {
            fromUser: {
              select: {
                id: true,
                telegramUserId: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
            toUser: {
              select: {
                id: true,
                telegramUserId: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      });

      // Fire notifications outside the transaction (fire-and-forget)
      const senderName = result.fromUser?.firstName ?? result.fromUser?.username ?? "用户";
      const recipientName = result.toUser?.firstName ?? result.toUser?.username ?? "用户";
      this.telegram.sendMessage(
        fromTelegramUserId,
        this.telegram.msgTransferSent(dto.amount, dto.assetCode, recipientName),
      );
      this.telegram.sendMessage(
        result.toUser.telegramUserId,
        this.telegram.msgTransferReceived(dto.amount, dto.assetCode, senderName),
      );

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.transferOrder.findUnique({
          where: {
            fromUserId_bizNo: {
              fromUserId,
              bizNo: dto.bizNo,
            },
          },
          include: {
            fromUser: {
              select: {
                id: true,
                telegramUserId: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
            toUser: {
              select: {
                id: true,
                telegramUserId: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
      }

      throw error;
    }
  }

  async listOrders(userId: string) {
    return this.prisma.transferOrder.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        toUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.transferOrder.findFirst({
      where: {
        id: orderId,
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        toUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Transfer order not found");
    }

    return order;
  }
}
