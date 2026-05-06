import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditActorType,
  Prisma,
  ReviewStatus,
  WalletAccountStatus,
  WithdrawStatus,
} from "@prisma/client";

import { env } from "../../config/env";
import { getSupportedAssetOrThrow } from "../../config/supported-assets";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { parseDecimal, parsePositiveDecimal } from "../../common/utils/decimal.util";
import { LedgerService } from "../ledger/ledger.service";

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createWithdrawal(
    userId: string,
    dto: {
      assetCode: string;
      network: string;
      amount: string;
      toAddress: string;
      note?: string;
    },
  ) {
    const amount = parsePositiveDecimal(dto.amount);
    const asset = getSupportedAssetOrThrow(dto.assetCode, dto.network);
    const fee = parseDecimal(asset.withdrawFee, "fee");
    const totalAmount = amount.plus(fee);
    const reviewThreshold = parseDecimal(env().WITHDRAW_MANUAL_REVIEW_THRESHOLD, "WITHDRAW_MANUAL_REVIEW_THRESHOLD");
    const requiresManualReview = amount.gt(reviewThreshold);

    return this.prisma.$transaction(async (tx) => {
      const walletAccount = await tx.walletAccount.findUnique({
        where: {
          userId_assetCode_network: {
            userId,
            assetCode: dto.assetCode,
            network: dto.network,
          },
        },
      });

      if (!walletAccount) {
        throw new NotFoundException("Wallet account does not exist for the selected asset");
      }

      if (walletAccount.status !== WalletAccountStatus.ACTIVE) {
        throw new BadRequestException("Wallet account is not active");
      }

      const walletUpdate = await tx.walletAccount.updateMany({
        where: {
          id: walletAccount.id,
          availableBalance: {
            gte: totalAmount,
          },
        },
        data: {
          availableBalance: {
            decrement: totalAmount,
          },
          frozenBalance: {
            increment: totalAmount,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw new BadRequestException("Insufficient available balance");
      }

      const order = await tx.withdrawOrder.create({
        data: {
          userId,
          assetCode: dto.assetCode,
          network: dto.network,
          toAddress: dto.toAddress,
          amount,
          fee,
          totalAmount,
          note: dto.note,
          requiresManualReview,
          reviewStatus: requiresManualReview ? ReviewStatus.PENDING : ReviewStatus.NOT_REQUIRED,
          status: requiresManualReview ? WithdrawStatus.PENDING_REVIEW : WithdrawStatus.READY_FOR_SIGNING,
        },
      });

      const journal = await this.ledgerService.freezeWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: dto.assetCode,
        network: dto.network,
        totalAmount,
        description: dto.note ?? `Withdraw to ${dto.toAddress}`,
      });

      return tx.withdrawOrder.update({
        where: { id: order.id },
        data: {
          freezeJournalId: journal.id,
        },
      });
    });
  }

  async listOrders(userId: string) {
    return this.prisma.withdrawOrder.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getOrder(userId: string, orderId: string) {
    const order = await this.prisma.withdrawOrder.findFirst({
      where: {
        id: orderId,
        userId,
      },
    });

    if (!order) {
      throw new NotFoundException("Withdrawal order not found");
    }

    return order;
  }

  async listAdminOrders(status?: WithdrawStatus) {
    return this.prisma.withdrawOrder.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /** @deprecated use listAdminOrders({ status: PENDING_REVIEW }) */
  async listReviewQueue() {
    return this.listAdminOrders(WithdrawStatus.PENDING_REVIEW);
  }

  async approveReview(orderId: string, adminUser: AuthenticatedUser, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException("Withdrawal order not found");
      }

      if (order.status !== WithdrawStatus.PENDING_REVIEW || order.reviewStatus !== ReviewStatus.PENDING) {
        throw new BadRequestException("Withdrawal is not waiting for manual review");
      }

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: {
          status: WithdrawStatus.READY_FOR_SIGNING,
          reviewStatus: ReviewStatus.APPROVED,
          reviewerId: adminUser.id,
          reviewerNote: note,
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "withdraw.approve_review",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: {
            note,
          },
        },
      });

      return updated;
    });
  }

  async rejectReview(orderId: string, adminUser: AuthenticatedUser, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException("Withdrawal order not found");
      }

      if (order.status !== WithdrawStatus.PENDING_REVIEW || order.reviewStatus !== ReviewStatus.PENDING) {
        throw new BadRequestException("Withdrawal is not waiting for manual review");
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

      if (!walletAccount) {
        throw new NotFoundException("Wallet account does not exist for this withdrawal");
      }

      const accountUpdate = await tx.walletAccount.updateMany({
        where: {
          id: walletAccount.id,
          frozenBalance: {
            gte: order.totalAmount,
          },
        },
        data: {
          frozenBalance: {
            decrement: order.totalAmount,
          },
          availableBalance: {
            increment: order.totalAmount,
          },
        },
      });

      if (accountUpdate.count !== 1) {
        throw new BadRequestException("Frozen balance is insufficient to reject this withdrawal");
      }

      const releaseJournal = await this.ledgerService.releaseWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        totalAmount: order.totalAmount,
        description: note ?? "Withdrawal review rejected",
      });

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: {
          status: WithdrawStatus.REJECTED,
          reviewStatus: ReviewStatus.REJECTED,
          reviewerId: adminUser.id,
          reviewerNote: note,
          reviewedAt: new Date(),
          releaseJournalId: releaseJournal.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "withdraw.reject_review",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { note },
        },
      });

      return updated;
    });
  }

  /**
   * Admin: sign the withdrawal (assign txHash, READY_FOR_SIGNING → SIGNED).
   */
  async signWithdrawal(orderId: string, adminUser: AuthenticatedUser, txHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({ where: { id: orderId } });

      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (order.status !== WithdrawStatus.READY_FOR_SIGNING) {
        throw new BadRequestException("Withdrawal is not in READY_FOR_SIGNING state");
      }

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: { status: WithdrawStatus.SIGNED, txHash },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "withdraw.sign",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { txHash },
        },
      });

      return updated;
    });
  }

  /**
   * Admin: confirm on-chain settlement (SIGNED → CONFIRMED).
   * Permanently deducts frozen balance via WITHDRAWAL_CONFIRM journal.
   */
  async confirmWithdrawal(orderId: string, adminUser: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({ where: { id: orderId } });

      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (order.status !== WithdrawStatus.SIGNED) {
        throw new BadRequestException("Withdrawal is not in SIGNED state");
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

      if (!walletAccount) throw new NotFoundException("Wallet account not found");

      const accountUpdate = await tx.walletAccount.updateMany({
        where: {
          id: walletAccount.id,
          frozenBalance: { gte: order.totalAmount },
        },
        data: { frozenBalance: { decrement: order.totalAmount } },
      });

      if (accountUpdate.count !== 1) {
        throw new BadRequestException("Frozen balance is insufficient to confirm this withdrawal");
      }

      const confirmJournal = await this.ledgerService.confirmWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        totalAmount: order.totalAmount,
        description: `Withdrawal confirmed on-chain: ${order.txHash ?? ""}`,
      });

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: { status: WithdrawStatus.CONFIRMED, confirmJournalId: confirmJournal.id },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "withdraw.confirm",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { txHash: order.txHash },
        },
      });

      return updated;
    });
  }

  /**
   * Admin: mark withdrawal as failed (READY_FOR_SIGNING | SIGNED → FAILED).
   * Releases frozen balance back to available.
   */
  async failWithdrawal(orderId: string, adminUser: AuthenticatedUser, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({ where: { id: orderId } });

      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (
        order.status !== WithdrawStatus.READY_FOR_SIGNING &&
        order.status !== WithdrawStatus.SIGNED
      ) {
        throw new BadRequestException("Withdrawal cannot be failed in its current state");
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

      if (!walletAccount) throw new NotFoundException("Wallet account not found");

      const accountUpdate = await tx.walletAccount.updateMany({
        where: {
          id: walletAccount.id,
          frozenBalance: { gte: order.totalAmount },
        },
        data: {
          frozenBalance: { decrement: order.totalAmount },
          availableBalance: { increment: order.totalAmount },
        },
      });

      if (accountUpdate.count !== 1) {
        throw new BadRequestException("Frozen balance is insufficient to fail this withdrawal");
      }

      const releaseJournal = await this.ledgerService.releaseWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        totalAmount: order.totalAmount,
        description: note ?? "Withdrawal failed",
      });

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: {
          status: WithdrawStatus.FAILED,
          releaseJournalId: releaseJournal.id,
          reviewerNote: note,
        },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUser.id,
          action: "withdraw.fail",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { note },
        },
      });

      return updated;
    });
  }

  /** System: mark order SIGNED after on-chain broadcast. */
  async signWithdrawalBySystem(orderId: string, txHash: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (order.status !== WithdrawStatus.READY_FOR_SIGNING) {
        throw new BadRequestException("Withdrawal is not in READY_FOR_SIGNING state");
      }

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: { status: WithdrawStatus.SIGNED, txHash },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.SYSTEM,
          actorUserId: null,
          action: "withdraw.sign",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { txHash },
        },
      });

      return updated;
    });
  }

  /** System: confirm on-chain settlement (SIGNED → CONFIRMED). */
  async confirmWithdrawalBySystem(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (order.status !== WithdrawStatus.SIGNED) {
        throw new BadRequestException("Withdrawal is not in SIGNED state");
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
      if (!walletAccount) throw new NotFoundException("Wallet account not found");

      const accountUpdate = await tx.walletAccount.updateMany({
        where: { id: walletAccount.id, frozenBalance: { gte: order.totalAmount } },
        data: { frozenBalance: { decrement: order.totalAmount } },
      });
      if (accountUpdate.count !== 1) {
        throw new BadRequestException("Frozen balance insufficient to confirm withdrawal");
      }

      const confirmJournal = await this.ledgerService.confirmWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        totalAmount: order.totalAmount,
        description: `Withdrawal confirmed on-chain: ${order.txHash ?? ""}`,
      });

      const updated = await tx.withdrawOrder.update({
        where: { id: order.id },
        data: { status: WithdrawStatus.CONFIRMED, confirmJournalId: confirmJournal.id },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.SYSTEM,
          actorUserId: null,
          action: "withdraw.confirm",
          resourceType: "withdraw_order",
          resourceId: order.id,
          metadata: { txHash: order.txHash },
        },
      });

      return updated;
    });
  }

  /**
   * User: cancel own withdrawal (only allowed while PENDING_REVIEW).
   */
  async cancelWithdrawal(userId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.withdrawOrder.findFirst({
        where: { id: orderId, userId },
      });

      if (!order) throw new NotFoundException("Withdrawal order not found");
      if (order.status !== WithdrawStatus.PENDING_REVIEW) {
        throw new ForbiddenException("Withdrawal can only be canceled while pending review");
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

      if (!walletAccount) throw new NotFoundException("Wallet account not found");

      await tx.walletAccount.updateMany({
        where: {
          id: walletAccount.id,
          frozenBalance: { gte: order.totalAmount },
        },
        data: {
          frozenBalance: { decrement: order.totalAmount },
          availableBalance: { increment: order.totalAmount },
        },
      });

      const releaseJournal = await this.ledgerService.releaseWithdrawal(tx, {
        referenceId: order.id,
        walletAccountId: walletAccount.id,
        assetCode: order.assetCode,
        network: order.network,
        totalAmount: order.totalAmount,
        description: "Withdrawal canceled by user",
      });

      return tx.withdrawOrder.update({
        where: { id: order.id },
        data: { status: WithdrawStatus.CANCELED, releaseJournalId: releaseJournal.id },
      });
    });
  }
}
