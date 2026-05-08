import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { supportedAssets } from "../../config/supported-assets";
import { PrismaService } from "../../common/prisma/prisma.service";
import { HotWalletService } from "../ton/hot-wallet.service";
import { Trc20HotWalletService } from "../trc20/trc20-hot-wallet.service";

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotWallet: HotWalletService,
    private readonly trc20HotWallet: Trc20HotWalletService,
  ) {}

  async getOrCreateDepositAddress(userId: string, assetCode: string, network: string) {
    const account = await this.prisma.walletAccount.findUniqueOrThrow({
      where: { userId_assetCode_network: { userId, assetCode, network } },
      include: { addresses: { where: { isPrimary: true }, take: 1 } },
    });

    if (account.addresses.length > 0) {
      const { address, memo } = account.addresses[0];
      return { assetCode, network, address, memo: memo ?? null };
    }

    const derived = await this.prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<[{ next_index: number }]>`
        INSERT INTO "DepositAddressCounter" (id, "nextIndex")
        VALUES (${network}, 1)
        ON CONFLICT (id) DO UPDATE
          SET "nextIndex" = "DepositAddressCounter"."nextIndex" + 1
        RETURNING "nextIndex" AS next_index
      `;
      const nextIndex = Number(result[0].next_index);

      let address: string;
      if (network === "TON") {
        if (!this.hotWallet.isEnabled)
          throw new ServiceUnavailableException("TON hot wallet not configured");
        address = this.hotWallet.deriveDepositAddress(nextIndex);
      } else if (network === "TRC20") {
        if (!this.trc20HotWallet.isEnabled)
          throw new ServiceUnavailableException("TRC20 hot wallet not configured");
        address = this.trc20HotWallet.deriveDepositAddress(nextIndex);
      } else {
        throw new BadRequestException(`Auto-derivation not supported for network: ${network}`);
      }

      await tx.walletAddress.create({
        data: { walletAccountId: account.id, address, isPrimary: true },
      });

      return { address, memo: null };
    });

    return { assetCode, network, address: derived.address, memo: derived.memo };
  }

  async listAccounts(userId: string) {
    return this.prisma.walletAccount.findMany({
      where: { userId },
      orderBy: [{ assetCode: "asc" }, { network: "asc" }],
    });
  }

  listSupportedAssets() {
    return supportedAssets;
  }

  async listTransactions(userId: string, limit: number, offset = 0) {
    const journals = await this.prisma.ledgerJournal.findMany({
      where: {
        entries: {
          some: {
            walletAccount: {
              userId,
            },
          },
        },
      },
      include: {
        entries: {
          where: {
            walletAccount: {
              userId,
            },
          },
          include: {
            walletAccount: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    return journals.map((journal) => ({
      id: journal.id,
      type: journal.type,
      referenceType: journal.referenceType,
      referenceId: journal.referenceId,
      description: journal.description,
      status: journal.status,
      createdAt: journal.createdAt,
      entries: journal.entries.map((entry) => ({
        id: entry.id,
        walletAccountId: entry.walletAccountId,
        assetCode: entry.assetCode,
        network: entry.network,
        direction: entry.direction,
        amount: entry.amount,
        ledgerAccountCode: entry.ledgerAccountCode,
        accountStatus: entry.walletAccount?.status,
      })),
    }));
  }
}
