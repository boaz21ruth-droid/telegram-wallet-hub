import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AssignDepositAddressDto } from "./dto/assign-deposit-address.dto";
import { CreditDepositDto } from "./dto/credit-deposit.dto";
import { ListDepositsQueryDto } from "./dto/list-deposits-query.dto";
import { DepositsService } from "./deposits.service";

@Controller("admin/deposits")
@UseGuards(AdminGuard)
export class AdminDepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  async listAll(@Query() query: ListDepositsQueryDto) {
    return this.depositsService.listAllDeposits(query.limit, query.offset);
  }

  @Post("credit")
  async credit(@CurrentUser() user: AuthenticatedUser, @Body() body: CreditDepositDto) {
    return this.depositsService.creditDeposit(user, body);
  }

  @Post("addresses")
  async assignAddress(@CurrentUser() user: AuthenticatedUser, @Body() body: AssignDepositAddressDto) {
    return this.depositsService.assignDepositAddress(user, body);
  }
}
