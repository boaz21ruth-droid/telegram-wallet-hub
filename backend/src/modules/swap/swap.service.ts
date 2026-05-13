import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, WalletAccountStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { parsePositiveDecimal } from "../../common/utils/decimal.util";
import { env } from "../../config/env";
import { LedgerService } from "../ledger/ledger.service";
import { PriceService } from "./price.service";

@Injectable()
export class SwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceService: PriceService,
    private readonly ledgerService: LedgerService,
  ) {}

  async getQuote(dto: {
    fromAssetCode: string;
    fromNetwork: string;
    fromAmount: string;
    toAssetCode: string;
    toNetwork: string;
  }) {
    const { SWAP_SPREAD_RATE, BRIDGE_SPREAD_RATE, BRIDGE_FIXED_FEE_USDT } = env();
    const fromAmount = parsePositiveDecimal(dto.fromAmount);
    const isBridge = dto.fromAssetCode === dto.toAssetCode && dto.fromNetwork !== dto.toNetwork;

    const spreadRate = new Prisma.Decimal(isBridge ? BRIDGE_SPREAD_RATE : SWAP_SPREAD_RATE);
    const fixedFee = isBridge ? new Prisma.Decimal(BRIDGE_FIXED_FEE_USDT) : undefined;

    return this.priceService.getSwapQuote({
      fromAssetCode: dto.fromAssetCode,
      fromNetwork: dto.fromNetwork,
      fromAmount,
      toAssetCode: dto.toAssetCode,
      toNetwork: dto.toNetwork,
      spreadRate,
      fixedFee,
    });
  }

  async createSwap(
    userId: string,
    dto: {
      fromAssetCode: string;
      fromNetwork: string;
      fromAmount: string;
      toAssetCode: string;
      toNetwork: string;
      minToAmount: string;
      bizNo: string;
    },
  ) {
    if (!dto.bizNo.trim()) throw new BadRequestException("bizNo is required");

    // Idempotency: return existing order if bizNo already used
    const existing = await this.prisma.swapOrder.findUnique({
      where: { userId_bizNo: { userId, bizNo: dto.bizNo } },
    });
    if (existing) return existing;

    const fromAmount = parsePositiveDecimal(dto.fromAmount);
    const minToAmount = parsePositiveDecimal(dto.minToAmount);
    const isBridge = dto.fromAssetCode === dto.toAssetCode && dto.fromNetwork !== dto.toNetwork;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const fromAccount = await tx.walletAccount.findUnique({
          where: {
            userId_assetCode_network: {
              userId,
              assetCode: dto.fromAssetCode,
              network: dto.fromNetwork,
            },
          },
        });
        const toAccount = await tx.walletAccount.findUnique({
          where: {
            userId_assetCode_network: {
              userId,
              assetCode: dto.toAssetCode,
              network: dto.toNetwork,
            },
          },
        });

        if (!fromAccount || !toAccount) {
          throw new BadRequestException("Wallet account not found for the selected asset");
        }
        if (
          fromAccount.status !== WalletAccountStatus.ACTIVE ||
          toAccount.status !== WalletAccountStatus.ACTIVE
        ) {
          throw new BadRequestException("Wallet account is not active");
        }

        // Recalculate quote fresh (don't trust client-supplied rate)
        const { SWAP_SPREAD_RATE, BRIDGE_SPREAD_RATE, BRIDGE_FIXED_FEE_USDT } = env();
        const spreadRate = new Prisma.Decimal(isBridge ? BRIDGE_SPREAD_RATE : SWAP_SPREAD_RATE);
        const fixedFee = isBridge ? new Prisma.Decimal(BRIDGE_FIXED_FEE_USDT) : undefined;
        const quote = await this.priceService.getSwapQuote({
          fromAssetCode: dto.fromAssetCode,
          fromNetwork: dto.fromNetwork,
          fromAmount,
          toAssetCode: dto.toAssetCode,
          toNetwork: dto.toNetwork,
          spreadRate,
          fixedFee,
        });

        // Slippage protection
        if (quote.toAmount.lt(minToAmount)) {
          throw new BadRequestException(
            `Quote slippage: expected ≥ ${minToAmount}, got ${quote.toAmount}`,
          );
        }

        // Atomic balance deduction with optimistic locking
        const deducted = await tx.walletAccount.updateMany({
          where: { id: fromAccount.id, availableBalance: { gte: fromAmount } },
          data: { availableBalance: { decrement: fromAmount } },
        });
        if (deducted.count !== 1) {
          throw new BadRequestException("Insufficient available balance");
        }

        await tx.walletAccount.update({
          where: { id: toAccount.id },
          data: { availableBalance: { increment: quote.toAmount } },
        });

        const swapOrder = await tx.swapOrder.create({
          data: {
            userId,
            fromAssetCode: dto.fromAssetCode,
            fromNetwork: dto.fromNetwork,
            fromAmount,
            toAssetCode: dto.toAssetCode,
            toNetwork: dto.toNetwork,
            toAmount: quote.toAmount,
            midRate: quote.midRate,
            feeRate: spreadRate,
            feeAmount: quote.feeAmount,
            bizNo: dto.bizNo,
          },
        });

        const journal = await this.ledgerService.recordSwap(tx, {
          swapOrderId: swapOrder.id,
          fromWalletAccountId: fromAccount.id,
          toWalletAccountId: toAccount.id,
          fromAssetCode: dto.fromAssetCode,
          fromNetwork: dto.fromNetwork,
          toAssetCode: dto.toAssetCode,
          toNetwork: dto.toNetwork,
          fromAmount,
          toAmount: quote.toAmount,
          feeAmount: quote.feeAmount,
          isBridge,
        });

        return tx.swapOrder.update({
          where: { id: swapOrder.id },
          data: { journalId: journal.id },
        });
      });
    } catch (error) {
      // Race condition: another request created the same bizNo concurrently
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.swapOrder.findUnique({
          where: { userId_bizNo: { userId, bizNo: dto.bizNo } },
        });
      }
      throw error;
    }
  }

  async listOrders(userId: string, limit = 20, offset = 0) {
    return this.prisma.swapOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }
}
