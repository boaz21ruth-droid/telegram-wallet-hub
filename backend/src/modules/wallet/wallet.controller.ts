import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListTransactionsQueryDto } from "./dto/list-transactions-query.dto";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("accounts")
  async listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.listAccounts(user.id);
  }

  @Get("assets")
  @Public()
  listAssets() {
    return this.walletService.listSupportedAssets();
  }

  @Get("transactions")
  async listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.walletService.listTransactions(user.id, query.limit, query.offset);
  }

  @Get("deposit-address")
  async getDepositAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Query("assetCode") assetCode: string,
    @Query("network") network: string,
  ) {
    return this.walletService.getOrCreateDepositAddress(user.id, assetCode, network);
  }
}
