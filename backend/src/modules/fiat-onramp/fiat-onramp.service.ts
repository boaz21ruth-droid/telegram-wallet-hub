import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { env } from "../../config/env";
import { LedgerService } from "../ledger/ledger.service";

@Injectable()
export class FiatOnrampService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  /** Get a buy quote: fiatAmount → cryptoAmount */
  getFiatQuote(fiatCurrency: string, fiatAmount: string, assetCode = "USDT", network = "TRC20") {
    const { FIAT_CNY_RATE, FIAT_FEE_RATE } = env();
    const fiat = new Prisma.Decimal(fiatAmount);
    // midRate: how many USDT per 1 unit of fiatCurrency
    const midRate = fiatCurrency === "CNY"
      ? new Prisma.Decimal(1).div(new Prisma.Decimal(FIAT_CNY_RATE))
      : new Prisma.Decimal(1); // USD
    const grossAmount = fiat.mul(midRate);
    const feeRate = new Prisma.Decimal(FIAT_FEE_RATE);
    const feeAmount = grossAmount.mul(feeRate);
    const cryptoAmount = grossAmount.sub(feeAmount);
    return { fiatCurrency, fiatAmount, assetCode, network, midRate, grossAmount, feeAmount, cryptoAmount, feeRate };
  }

  /** Create a new fiat order (PENDING_PAYMENT) */
  async createOrder(
    userId: string,
    dto: { fiatCurrency: string; fiatAmount: string; assetCode?: string; network?: string; paymentMethodCode?: string },
  ) {
    const { FIAT_ORDER_EXPIRE_MINUTES } = env();
    const assetCode = dto.assetCode ?? "USDT";
    const network = dto.network ?? "TRC20";
    const quote = this.getFiatQuote(dto.fiatCurrency, dto.fiatAmount, assetCode, network);

    // Copy payment method snapshot
    let paymentAccountRef: string | null = null;
    if (dto.paymentMethodCode) {
      const pm = await this.prisma.fiatPaymentMethod.findUnique({ where: { code: dto.paymentMethodCode } });
      if (!pm || !pm.isActive) throw new BadRequestException("Payment method not available");
      paymentAccountRef = `${pm.accountName} / ${pm.accountNumber}`;
    }

    const expiresAt = new Date(Date.now() + FIAT_ORDER_EXPIRE_MINUTES * 60_000);
    return this.prisma.fiatOnrampOrder.create({
      data: {
        userId,
        fiatCurrency: dto.fiatCurrency,
        fiatAmount: quote.fiatAmount,
        assetCode,
        network,
        cryptoAmount: quote.cryptoAmount,
        grossAmount: quote.grossAmount,
        feeAmount: quote.feeAmount,
        exchangeRate: quote.midRate,
        feeRate: quote.feeRate,
        paymentMethodCode: dto.paymentMethodCode,
        paymentAccountRef,
        expiresAt,
      },
    });
  }

  /** User uploads payment proof */
  async submitPaymentProof(userId: string, orderId: string, proofPath: string, paymentNote?: string) {
    const order = await this.prisma.fiatOnrampOrder.findFirst({
      where: { id: orderId, userId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "PENDING_PAYMENT") {
      throw new BadRequestException("Order is not in PENDING_PAYMENT status");
    }
    if (order.expiresAt < new Date()) {
      throw new BadRequestException("Order has expired");
    }
    return this.prisma.fiatOnrampOrder.update({
      where: { id: orderId },
      data: { status: "PAYMENT_SUBMITTED", paymentProofPath: proofPath, paymentNote },
    });
  }

  /** User cancels their own order */
  async cancelOrder(userId: string, orderId: string) {
    const order = await this.prisma.fiatOnrampOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException("Order not found");
    if (!["PENDING_PAYMENT", "PAYMENT_SUBMITTED"].includes(order.status)) {
      throw new BadRequestException("Order cannot be cancelled at this stage");
    }
    return this.prisma.fiatOnrampOrder.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });
  }

  async listUserOrders(userId: string, limit = 20, offset = 0) {
    return this.prisma.fiatOnrampOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  // ── Admin methods ────────────────────────────────────────────────────────────

  async startReview(adminId: string, orderId: string) {
    const order = await this.prisma.fiatOnrampOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "PAYMENT_SUBMITTED") {
      throw new BadRequestException("Order must be in PAYMENT_SUBMITTED status");
    }
    return this.prisma.fiatOnrampOrder.update({
      where: { id: orderId },
      data: { status: "UNDER_REVIEW", reviewerId: adminId },
    });
  }

  async approveOrder(adminId: string, orderId: string, reviewerNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.fiatOnrampOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status !== "UNDER_REVIEW") {
        throw new BadRequestException("Order must be in UNDER_REVIEW status");
      }

      const walletAccount = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId: order.userId,
            assetCode: order.assetCode,
            network: order.network,
          },
        },
      });
      if (!walletAccount) throw new NotFoundException("User wallet account not found");

      // Credit user
      await tx.walletAccount.update({
        where: { id: walletAccount.id },
        data: { availableBalance: { increment: order.cryptoAmount } },
      });

      // Update order
      const updated = await tx.fiatOnrampOrder.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          reviewerId: adminId,
          reviewerNote,
          reviewedAt: new Date(),
        },
      });

      // Record ledger
      const journal = await this.ledgerService.recordFiatOnramp(tx, {
        fiatOrderId: orderId,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        grossAmount: order.grossAmount,
        feeAmount: order.feeAmount,
        cryptoAmount: order.cryptoAmount,
      });

      return tx.fiatOnrampOrder.update({
        where: { id: orderId },
        data: { journalId: journal.id },
      }) ?? updated;
    });
  }

  async rejectOrder(adminId: string, orderId: string, reviewerNote?: string) {
    const order = await this.prisma.fiatOnrampOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");
    if (!["UNDER_REVIEW", "PAYMENT_SUBMITTED"].includes(order.status)) {
      throw new BadRequestException("Order cannot be rejected at this stage");
    }
    return this.prisma.fiatOnrampOrder.update({
      where: { id: orderId },
      data: { status: "REJECTED", reviewerId: adminId, reviewerNote, reviewedAt: new Date() },
    });
  }

  async listAdminOrders(limit = 50, offset = 0, status?: string) {
    return this.prisma.fiatOnrampOrder.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, telegramUserId: true, username: true } } },
    });
  }

  // ── Scheduled tasks ──────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleOrders() {
    await this.prisma.fiatOnrampOrder.updateMany({
      where: { status: "PENDING_PAYMENT", expiresAt: { lte: new Date() } },
      data: { status: "EXPIRED" },
    });
  }

  // ── Payment methods ──────────────────────────────────────────────────────────

  async listPaymentMethods() {
    return this.prisma.fiatPaymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async adminListPaymentMethods() {
    return this.prisma.fiatPaymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
  }

  async adminCreatePaymentMethod(dto: {
    code: string;
    displayName: string;
    accountName: string;
    accountNumber: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.fiatPaymentMethod.create({ data: dto });
  }

  async adminUpdatePaymentMethod(
    id: string,
    dto: {
      displayName?: string;
      accountName?: string;
      accountNumber?: string;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.fiatPaymentMethod.update({ where: { id }, data: dto });
  }

  async adminDeletePaymentMethod(id: string) {
    await this.prisma.fiatPaymentMethod.delete({ where: { id } });
  }
}
