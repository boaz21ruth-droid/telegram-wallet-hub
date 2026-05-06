import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditActorType, DepositStatus, Prisma, WalletAccountStatus } from "@prisma/client";

import { getSupportedAssetOrThrow } from "../../config/supported-assets";
import { PrismaService } from "../../common/prisma/prisma.service";
import { TelegramNotificationService } from "../../common/telegram/telegram-notification.service";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { parsePositiveDecimal } from "../../common/utils/decimal.util";
import { LedgerService } from "../ledger/ledger.service";

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly telegram: TelegramNotificationService,
  ) {}

  /**
   * Returns the primary deposit address for a given wallet account.
   * If none exists yet, returns null — addresses must be assigned by admin.
   */
  async getDepositAddress(userId: string, assetCode: string, network: string) {
    getSupportedAssetOrThrow(assetCode, network);

    const account = await this.prisma.walletAccount.findUnique({
      where: { userId_assetCode_network: { userId, assetCode, network } },
      include: {
        addresses: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!account) throw new NotFoundException("Wallet account not found");

    return {
      assetCode: account.assetCode,
      network: account.network,
      address: account.addresses[0]?.address ?? null,
      memo: account.addresses[0]?.memo ?? null,
    };
  }

  /**
   * Admin: assign a deposit address to a wallet account.
   */
  async assignDepositAddress(
    adminUser: AuthenticatedUser,
    params: {
      telegramUserId: string;
      assetCode: string;
      network: string;
      address: string;
      memo?: string;
    },
  ) {
    getSupportedAssetOrThrow(params.assetCode, params.network);

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: params.telegramUserId },
    });
    if (!user) throw new NotFoundException("User not found");

    const account = await this.prisma.walletAccount.findUnique({
      where: {
        userId_assetCode_network: {
          userId: user.id,
          assetCode: params.assetCode,
          network: params.network,
        },
      },
    });
    if (!account) throw new NotFoundException("Wallet account not found");

    return this.prisma.$transaction(async (tx) => {
      // Clear existing primary flag
      await tx.walletAddress.updateMany({
        where: { walletAccountId: account.id, isPrimary: true },
        data: { isPrimary: false },
      });

      const walletAddress = await tx.walletAddress.upsert({
        where: { address: params.address },
        update: { memo: params.memo, isPrimary: true, walletAccountId: account.id },
        create: {
          walletAccountId: account.id,
          address: params.address,
          memo: params.memo,
          isPrimary: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "deposit.assign_address",
          resourceType: "wallet_account",
          resourceId: account.id,
          metadata: { address: params.address, memo: params.memo },
        },
      });

      return walletAddress;
    });
  }

  /**
   * Admin: credit a deposit to a user's wallet.
   * Creates a DepositOrder and a DEPOSIT ledger journal atomically.
   */
  async creditDeposit(
    adminUser: AuthenticatedUser,
    dto: {
      telegramUserId: string;
      assetCode: string;
      network: string;
      amount: string;
      fromAddress?: string;
      txHash?: string;
      note?: string;
    },
  ) {
    const amount = parsePositiveDecimal(dto.amount);
    getSupportedAssetOrThrow(dto.assetCode, dto.network);

    let notifyTelegramUserId: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { telegramUserId: dto.telegramUserId },
      });
      if (!user) throw new NotFoundException("User not found");
      notifyTelegramUserId = user.telegramUserId;

      const walletAccount = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId: user.id,
            assetCode: dto.assetCode,
            network: dto.network,
          },
        },
      });
      if (!walletAccount) throw new NotFoundException("Wallet account not found");
      if (walletAccount.status !== WalletAccountStatus.ACTIVE) {
        throw new BadRequestException("Wallet account is not active");
      }

      await tx.walletAccount.update({
        where: { id: walletAccount.id },
        data: { availableBalance: { increment: amount } },
      });

      const order = await tx.depositOrder.create({
        data: {
          userId: user.id,
          assetCode: dto.assetCode,
          network: dto.network,
          fromAddress: dto.fromAddress,
          amount,
          txHash: dto.txHash,
          note: dto.note,
          status: DepositStatus.CONFIRMED,
          creditedAt: new Date(),
        },
      });

      const journal = await this.ledgerService.recordDeposit(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: dto.assetCode,
        network: dto.network,
        amount,
        description: dto.note ?? `Deposit credited by admin`,
      });

      await tx.depositOrder.update({
        where: { id: order.id },
        data: { journalId: journal.id },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "deposit.credit",
          resourceType: "deposit_order",
          resourceId: order.id,
          metadata: { amount: dto.amount, txHash: dto.txHash },
        },
      });

      return { ...order, journalId: journal.id };
    });

    if (notifyTelegramUserId) {
      this.telegram.sendMessage(
        notifyTelegramUserId,
        this.telegram.msgDepositCredited(dto.amount, dto.assetCode),
      );
    }

    return result;
  }

  async listUserDeposits(userId: string, limit: number, offset: number) {
    return this.prisma.depositOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async listAllDeposits(limit: number, offset: number) {
    return this.prisma.depositOrder.findMany({
      include: {
        user: {
          select: { id: true, telegramUserId: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * System-initiated deposit credit (no admin actor required).
   * Idempotent: silently returns the existing order if txHash already processed.
   */
  async creditDepositBySystem(dto: {
    walletAccountId: string;
    assetCode: string;
    network: string;
    amount: string;
    fromAddress?: string;
    txHash: string;
  }) {
    const amount = parsePositiveDecimal(dto.amount);
    getSupportedAssetOrThrow(dto.assetCode, dto.network);

    let notifyTelegramUserId: string | null = null;

    try {
    const result = await this.prisma.$transaction(async (tx) => {
      // Idempotency: if already credited return existing record
      const existing = await tx.depositOrder.findUnique({ where: { txHash: dto.txHash } });
      if (existing) return existing;

      const walletAccount = await tx.walletAccount.findUnique({
        where: { id: dto.walletAccountId },
      });
      if (!walletAccount) throw new NotFoundException("Wallet account not found");
      if (walletAccount.status !== WalletAccountStatus.ACTIVE) {
        throw new BadRequestException("Wallet account is not active");
      }
      if (walletAccount.assetCode !== dto.assetCode || walletAccount.network !== dto.network) {
        throw new BadRequestException(
          `Wallet account asset mismatch: expected ${dto.assetCode}/${dto.network}`,
        );
      }

      const user = await tx.user.findUnique({ where: { id: walletAccount.userId } });
      if (!user) throw new NotFoundException("User not found");
      notifyTelegramUserId = user.telegramUserId;

      await tx.walletAccount.update({
        where: { id: walletAccount.id },
        data: { availableBalance: { increment: amount } },
      });

      const order = await tx.depositOrder.create({
        data: {
          userId: user.id,
          assetCode: dto.assetCode,
          network: dto.network,
          fromAddress: dto.fromAddress,
          amount,
          txHash: dto.txHash,
          note: `Auto-detected on-chain deposit`,
          status: DepositStatus.CONFIRMED,
          creditedAt: new Date(),
        },
      });

      const journal = await this.ledgerService.recordDeposit(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: dto.assetCode,
        network: dto.network,
        amount,
        description: `On-chain deposit from ${dto.fromAddress ?? "unknown"}`,
      });

      await tx.depositOrder.update({
        where: { id: order.id },
        data: { journalId: journal.id },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.SYSTEM,
          actorUserId: null,
          action: "deposit.credit",
          resourceType: "deposit_order",
          resourceId: order.id,
          metadata: {
            amount: dto.amount,
            txHash: dto.txHash,
            fromAddress: dto.fromAddress ?? null,
          },
        },
      });

      return { ...order, journalId: journal.id };
    });

    if (notifyTelegramUserId) {
      this.telegram.sendMessage(
        notifyTelegramUserId,
        this.telegram.msgDepositCredited(dto.amount, dto.assetCode),
      );
    }

    return result;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.depositOrder.findUnique({
          where: { txHash: dto.txHash },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }
}
