import { BadRequestException, Injectable } from "@nestjs/common";
import { JournalType, LedgerEntryDirection, Prisma } from "@prisma/client";

import {
  availableAccountCode,
  frozenAccountCode,
  PLATFORM_ADJUSTMENT,
  PLATFORM_BRIDGE_FEE,
  PLATFORM_CLEARING,
  PLATFORM_FIAT_FEE,
  PLATFORM_RESERVE,
  PLATFORM_STAKING_FEE,
  PLATFORM_SWAP_FEE,
  PLATFORM_YIELD_POOL,
  stakedAccountCode,
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
   * Swap or bridge: 4-entry journal across two assets.
   * Entry 1: USER_AVAILABLE:{from}  DEBIT  fromAmount  (fromAsset)
   * Entry 2: PLATFORM_SWAP/BRIDGE   CREDIT feeAmount   (toAsset)
   * Entry 3: PLATFORM_RESERVE       DEBIT  toAmount    (toAsset)
   * Entry 4: USER_AVAILABLE:{to}    CREDIT toAmount    (toAsset)
   */
  /**
   * Swap or bridge: 4-entry journal across two assets.
   * toAsset balance: PLATFORM_RESERVE DEBIT grossOut = PLATFORM_FEE CREDIT feeAmount + USER CREDIT toAmount
   */
  async recordSwap(
    tx: TxClient,
    params: {
      swapOrderId: string;
      fromWalletAccountId: string;
      toWalletAccountId: string;
      fromAssetCode: string;
      fromNetwork: string;
      toAssetCode: string;
      toNetwork: string;
      fromAmount: Prisma.Decimal;
      toAmount: Prisma.Decimal;
      feeAmount: Prisma.Decimal;
      isBridge: boolean;
      note?: string;
    },
  ) {
    const feeAccountCode = params.isBridge ? PLATFORM_BRIDGE_FEE : PLATFORM_SWAP_FEE;
    const grossOut = params.toAmount.add(params.feeAmount);
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.SWAP,
        referenceType: "swap_order",
        referenceId: params.swapOrderId,
        description: params.note,
        entries: {
          create: [
            // fromAsset: user pays
            {
              walletAccountId: params.fromWalletAccountId,
              ledgerAccountCode: availableAccountCode(params.fromWalletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.fromAssetCode,
              network: params.fromNetwork,
              amount: params.fromAmount,
            },
            // toAsset: platform reserve pays out grossOut, offset by fee income + user credit
            {
              ledgerAccountCode: PLATFORM_RESERVE,
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.toAssetCode,
              network: params.toNetwork,
              amount: grossOut,
            },
            {
              ledgerAccountCode: feeAccountCode,
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.toAssetCode,
              network: params.toNetwork,
              amount: params.feeAmount,
            },
            {
              walletAccountId: params.toWalletAccountId,
              ledgerAccountCode: availableAccountCode(params.toWalletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.toAssetCode,
              network: params.toNetwork,
              amount: params.toAmount,
            },
          ],
        },
      },
    });
  }

  /**
   * Fiat on-ramp approval: 3-entry journal.
   * PLATFORM_RESERVE DEBIT grossAmount → PLATFORM_FIAT_FEE CREDIT feeAmount + USER CREDIT cryptoAmount
   */
  async recordFiatOnramp(
    tx: TxClient,
    params: {
      fiatOrderId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      grossAmount: Prisma.Decimal;
      feeAmount: Prisma.Decimal;
      cryptoAmount: Prisma.Decimal;
      note?: string;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.FIAT_ONRAMP,
        referenceType: "fiat_onramp_order",
        referenceId: params.fiatOrderId,
        description: params.note,
        entries: {
          create: [
            {
              ledgerAccountCode: PLATFORM_RESERVE,
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.grossAmount,
            },
            {
              ledgerAccountCode: PLATFORM_FIAT_FEE,
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.feeAmount,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.cryptoAmount,
            },
          ],
        },
      },
    });
  }

  /** Staking lock: USER_AVAILABLE DEBIT → USER_STAKED CREDIT */
  async recordStakingLock(
    tx: TxClient,
    params: {
      stakingOrderId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      amount: Prisma.Decimal;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.STAKING_LOCK,
        referenceType: "staking_order",
        referenceId: params.stakingOrderId,
        entries: {
          create: [
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: availableAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.amount,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: stakedAccountCode(params.walletAccountId),
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

  /** Staking unlock (redeem): USER_STAKED DEBIT total → USER_AVAILABLE CREDIT total */
  async recordStakingUnlock(
    tx: TxClient,
    params: {
      stakingOrderId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      amount: Prisma.Decimal;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.STAKING_UNLOCK,
        referenceType: "staking_order",
        referenceId: params.stakingOrderId,
        entries: {
          create: [
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: stakedAccountCode(params.walletAccountId),
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
   * Staking yield distribution.
   * PLATFORM_YIELD_POOL DEBIT grossYield → PLATFORM_STAKING_FEE CREDIT platformFee + USER_STAKED CREDIT netYield
   */
  async recordStakingYield(
    tx: TxClient,
    params: {
      yieldRecordId: string;
      walletAccountId: string;
      assetCode: string;
      network: string;
      grossYield: Prisma.Decimal;
      platformFee: Prisma.Decimal;
      netYield: Prisma.Decimal;
    },
  ) {
    return tx.ledgerJournal.create({
      data: {
        type: JournalType.STAKING_YIELD,
        referenceType: "staking_yield_record",
        referenceId: params.yieldRecordId,
        entries: {
          create: [
            {
              ledgerAccountCode: PLATFORM_YIELD_POOL,
              direction: LedgerEntryDirection.DEBIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.grossYield,
            },
            {
              ledgerAccountCode: PLATFORM_STAKING_FEE,
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.platformFee,
            },
            {
              walletAccountId: params.walletAccountId,
              ledgerAccountCode: stakedAccountCode(params.walletAccountId),
              direction: LedgerEntryDirection.CREDIT,
              assetCode: params.assetCode,
              network: params.network,
              amount: params.netYield,
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
