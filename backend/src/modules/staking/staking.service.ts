import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StakingOrderStatus, WalletAccountStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { LedgerService } from "../ledger/ledger.service";
import { StakeAssetDto } from "./dto/stake-asset.dto";

function parsePositiveDecimal(val: string): Prisma.Decimal {
  const d = new Prisma.Decimal(val);
  if (d.lte(0)) throw new BadRequestException("Amount must be positive");
  return d;
}

@Injectable()
export class StakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async listProducts() {
    return this.prisma.stakingProduct.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async listMyOrders(userId: string, limit = 20, offset = 0) {
    return this.prisma.stakingOrder.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async stakeAsset(userId: string, dto: StakeAssetDto) {
    const amount = parsePositiveDecimal(dto.amount);

    const product = await this.prisma.stakingProduct.findUnique({
      where: { id: dto.productId },
    });
    if (!product || !product.isActive) {
      throw new NotFoundException("Staking product not found or inactive");
    }
    if (amount.lt(product.minAmount)) {
      throw new BadRequestException(`Minimum staking amount is ${product.minAmount}`);
    }
    if (product.maxAmount && amount.gt(product.maxAmount)) {
      throw new BadRequestException(`Maximum staking amount is ${product.maxAmount}`);
    }

    // Check TVL cap
    if (product.totalCap) {
      const totalStaked = await this.prisma.stakingOrder.aggregate({
        where: { productId: product.id, status: StakingOrderStatus.ACTIVE },
        _sum: { principal: true },
      });
      const currentTvl = totalStaked._sum.principal ?? new Prisma.Decimal(0);
      if (currentTvl.add(amount).gt(product.totalCap)) {
        throw new BadRequestException("Product TVL cap reached");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId,
            assetCode: product.assetCode,
            network: product.network,
          },
        },
      });
      if (!account || account.status !== WalletAccountStatus.ACTIVE) {
        throw new BadRequestException("Wallet account not found or inactive");
      }

      const deducted = await tx.walletAccount.updateMany({
        where: {
          id: account.id,
          availableBalance: { gte: amount },
        },
        data: {
          availableBalance: { decrement: amount },
          stakedBalance: { increment: amount },
        },
      });
      if (deducted.count !== 1) {
        throw new BadRequestException("Insufficient balance");
      }

      const now = new Date();
      const nextYieldAt = new Date(now.getTime() + 60 * 60 * 1000); // +1h
      const maturesAt = product.lockDays > 0
        ? new Date(now.getTime() + product.lockDays * 24 * 60 * 60 * 1000)
        : null;

      const order = await tx.stakingOrder.create({
        data: {
          userId,
          productId: product.id,
          assetCode: product.assetCode,
          network: product.network,
          principal: amount,
          nextYieldAt,
          maturesAt,
        },
      });

      const journal = await this.ledger.recordStakingLock(tx, {
        stakingOrderId: order.id,
        walletAccountId: account.id,
        assetCode: product.assetCode,
        network: product.network,
        amount,
      });

      await tx.stakingOrder.update({
        where: { id: order.id },
        data: { lockJournalId: journal.id },
      });

      return tx.stakingOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { product: true },
      });
    });
  }

  async redeemStaking(userId: string, orderId: string) {
    const order = await this.prisma.stakingOrder.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException("Staking order not found");
    if (order.userId !== userId) throw new ForbiddenException();
    if (order.status !== StakingOrderStatus.ACTIVE) {
      throw new BadRequestException("Order is not active");
    }

    // For FIXED products, check maturity
    if (order.product.productType === "FIXED" && order.maturesAt && order.maturesAt > new Date()) {
      throw new BadRequestException(
        `Order matures on ${order.maturesAt.toISOString()}`,
      );
    }

    const totalAmount = order.principal.add(order.accruedYield);

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId,
            assetCode: order.assetCode,
            network: order.network,
          },
        },
      });
      if (!account) throw new BadRequestException("Wallet account not found");

      await tx.walletAccount.update({
        where: { id: account.id },
        data: {
          stakedBalance: { decrement: totalAmount },
          availableBalance: { increment: totalAmount },
        },
      });

      await tx.stakingOrder.update({
        where: { id: orderId },
        data: { status: StakingOrderStatus.REDEEMED },
      });

      const journal = await this.ledger.recordStakingUnlock(tx, {
        stakingOrderId: orderId,
        walletAccountId: account.id,
        assetCode: order.assetCode,
        network: order.network,
        amount: totalAmount,
      });

      return tx.stakingOrder.update({
        where: { id: orderId },
        data: { unlockJournalId: journal.id },
        include: { product: true },
      });
    });
  }
}
