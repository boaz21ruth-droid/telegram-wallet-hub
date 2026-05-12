import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma, StakingOrderStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { env } from "../../config/env";

@Injectable()
export class StakingYieldScheduler {
  private readonly logger = new Logger(StakingYieldScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async processYieldAccrual() {
    const { STAKING_PLATFORM_FEE_RATE } = env();
    const platformFeeRate = new Prisma.Decimal(STAKING_PLATFORM_FEE_RATE);
    const now = new Date();

    const orders = await this.prisma.stakingOrder.findMany({
      where: {
        status: StakingOrderStatus.ACTIVE,
        nextYieldAt: { lte: now },
      },
      include: { product: true },
    });

    if (!orders.length) return;

    let processed = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        const apy = new Prisma.Decimal(order.product.currentApy.toString());
        const grossYield = order.principal.mul(apy).div(8760);
        if (grossYield.lte(0)) continue;

        const platformFee = grossYield.mul(platformFeeRate);
        const netYield = grossYield.sub(platformFee);
        const nextYieldAt = new Date(now.getTime() + 60 * 60 * 1000);
        const periodStart = order.nextYieldAt ?? order.createdAt;

        await this.prisma.$transaction(async (tx) => {
          const account = await tx.walletAccount.findUnique({
            where: {
              userId_assetCode_network: {
                userId: order.userId,
                assetCode: order.assetCode,
                network: order.network,
              },
            },
          });
          if (!account) return;

          await tx.walletAccount.update({
            where: { id: account.id },
            data: { stakedBalance: { increment: netYield } },
          });

          // Generate a placeholder yield record id to use as ledger referenceId,
          // then create journal first (journalId must be non-null on YieldRecord)
          const yieldRecordId = crypto.randomUUID();

          const journal = await this.ledger.recordStakingYield(tx, {
            yieldRecordId,
            walletAccountId: account.id,
            assetCode: order.assetCode,
            network: order.network,
            grossYield,
            platformFee,
            netYield,
          });

          await tx.stakingYieldRecord.create({
            data: {
              id: yieldRecordId,
              stakingOrderId: order.id,
              userId: order.userId,
              assetCode: order.assetCode,
              network: order.network,
              grossYield,
              platformFee,
              netYield,
              journalId: journal.id,
              periodStart,
              periodEnd: now,
            },
          });

          await tx.stakingOrder.update({
            where: { id: order.id },
            data: {
              accruedYield: { increment: netYield },
              lastYieldAt: now,
              nextYieldAt,
            },
          });
        });

        processed++;
      } catch (err) {
        this.logger.error(`Yield accrual failed for order ${order.id}`, err);
        failed++;
      }
    }

    this.logger.log(`Yield accrual: ${processed} processed, ${failed} failed`);
  }
}
