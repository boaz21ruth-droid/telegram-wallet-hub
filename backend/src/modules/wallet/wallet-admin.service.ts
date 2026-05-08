import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditActorType } from "@prisma/client";
import { randomUUID } from "crypto";

import { getSupportedAssetOrThrow } from "../../config/supported-assets";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { parseDecimal } from "../../common/utils/decimal.util";
import { LedgerService } from "../ledger/ledger.service";

@Injectable()
export class WalletAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createAdjustment(
    adminUser: AuthenticatedUser,
    dto: {
      telegramUserId: string;
      assetCode: string;
      network: string;
      delta: string;
      note?: string;
    },
  ) {
    const delta = parseDecimal(dto.delta, "delta");
    if (delta.isZero()) throw new BadRequestException("delta must not be zero");
    getSupportedAssetOrThrow(dto.assetCode, dto.network);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { telegramUserId: dto.telegramUserId } });
      if (!user) throw new NotFoundException("User not found");

      const account = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId: user.id,
            assetCode: dto.assetCode,
            network: dto.network,
          },
        },
      });
      if (!account) throw new NotFoundException("Wallet account not found");

      const absAmount = delta.abs();

      if (delta.lt(0)) {
        const update = await tx.walletAccount.updateMany({
          where: {
            id: account.id,
            availableBalance: { gte: absAmount },
          },
          data: { availableBalance: { decrement: absAmount } },
        });
        if (update.count !== 1) {
          throw new BadRequestException("Insufficient available balance for this deduction");
        }
      } else {
        await tx.walletAccount.update({
          where: { id: account.id },
          data: { availableBalance: { increment: absAmount } },
        });
      }

      const referenceId = randomUUID();
      const journal = await this.ledgerService.recordAdjustment(tx, {
        referenceId,
        walletAccountId: account.id,
        assetCode: dto.assetCode,
        network: dto.network,
        delta,
        description: dto.note ?? `Admin adjustment by ${adminUser.telegramUserId}`,
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "wallet.adjustment",
          resourceType: "wallet_account",
          resourceId: account.id,
          metadata: { delta: dto.delta, note: dto.note, journalId: journal.id },
        },
      });

      return { journalId: journal.id, delta: dto.delta, assetCode: dto.assetCode, network: dto.network };
    });
  }

  async listAuditLogs(limit: number, offset: number, resourceType?: string) {
    return this.prisma.auditLog.findMany({
      where: resourceType ? { resourceType } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }
}
