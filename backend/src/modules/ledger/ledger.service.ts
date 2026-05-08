import { BadRequestException, Injectable } from "@nestjs/common";
import { JournalType, LedgerEntryDirection, Prisma } from "@prisma/client";

import {
  availableAccountCode,
  frozenAccountCode,
  PLATFORM_ADJUSTMENT,
  PLATFORM_CLEARING,
  PLATFORM_RESERVE,
} from "./ledger-account-code.util";

type TxClient = Prisma.TransactionClient;

@Injectable()
export class LedgerService {
  async recordTransfer(
    tx: TxClient,
    params: {
      referenceId: string;
      fromWalletAccountId: string;
      toWalletAccountId: string;
      assetCode: string;
      network: string;
      amount: Prisma.Decimal;
      description?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.TRANSFER,
        referenceType: "transfer_order",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              walletAccountId: params.fromWalletAccountId,
              ledgerAccountCode: availableAccountCode(params.fromWalletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.amount,
            },
            {
              walletAccountId: params.toWalletAccountId,
              ledgerAccountCode: availableAccountCode(params.toWalletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.amount,
            },
          ],
        },
      },
    });
  }

  async freezeWithdrawal(
    tx: TxClient,
    params: {
      referenceId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      totalAmount: Prisma.Decimal;
      description?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.WITHDRAWAL_FREEZE,
        referenceType: "withdraw_order",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: frozenAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
          ],
        },
      },
    });
  }

  async releaseWithdrawal(
    tx: TxClient,
    params: {
      referenceId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      totalAmount: Prisma.Decimal;
      description?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.WITHDRAWAL_RELEASE,
        referenceType: "withdraw_order",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: frozenAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
          ],
        },
      },
    });
  }

  /**
   * Withdrawal confirmed on-chain: permanently deduct frozen balance to platform clearing.
   * USER_FROZEN DEBIT + PLATFORM_CLEARING CREDIT
   */
  async confirmWithdrawal(
    tx: TxClient,
    params: {
      referenceId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      totalAmount: Prisma.Decimal;
      description?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.WITHDRAWAL_CONFIRM,
        referenceType: "withdraw_order",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: frozenAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
            {
              ledgerAccountCode: PLATFORM_CLEARING,
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.totalAmount,
            },
          ],
        },
      },
    });
  }

  /**
   * Deposit credited to user: PLATFORM_RESERVE DEBIT + USER_AVAILABLE CREDIT
   */
  async recordDeposit(
    tx: TxClient,
    params: {
      referenceId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      amount: Prisma.Decimal;
      description?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.DEPOSIT,
        referenceType: "deposit_order",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              ledgerAccountCode: PLATFORM_RESERVE,
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.amount,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.amount,
            },
          ],
        },
      },
    });
  }

  /**
   * Admin manual balance adjustment.
   * Positive delta: PLATFORM_ADJUSTMENT DEBIT + USER_AVAILABLE CREDIT
   * Negative delta: USER_AVAILABLE DEBIT + PLATFORM_ADJUSTMENT CREDIT
   */
  async recordAdjustment(
    tx: TxClient,
    params: {
      referenceId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      delta: Prisma.Decimal;
      description?: string;
    },
  ) {
    if (params.delta.isZero()) {
      throw new BadRequestException("Adjustment delta must not be zero");
    }

    const absAmount = params.delta.abs();
    const isCredit = params.delta.gt(0);

    return tx.ledgerJournal.create({
      data: {
        type: JournalType.ADJUSTMENT,
        referenceType: "adjustment",
        referenceId: params.referenceId,
        description: params.description,
        entries: {
          create: [
            {
              walletAccountId: isCredit ? null : params.walletAccountId,
              ledgerAccountCode: isCredit ? PLATFORM_ADJUSTMENT : availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: absAmount,
            },
            {
              walletAccountId: isCredit ? params.walletAccountId : null,
              ledgerAccountCode: isCredit ? availableAccountCode(params.walletAccountId) : PLATFORM_ADJUSTMENT,
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: absAmount,
            },
          ],
        },
      },
    });
  }
}
