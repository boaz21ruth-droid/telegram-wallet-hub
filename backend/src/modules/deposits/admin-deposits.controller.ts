import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { AssignDepositAddressDto } from "./dto/assign-deposit-address.dto";
import { CreditDepositDto } from "./dto/credit-deposit.dto";
import { ListDepositsQueryDto } from "./dto/list-deposits-query.dto";
import { DepositsService } from "./deposits.service";

@Controller("admin/deposits")
@Public()
@UseGuards(AdminGuard)
export class AdminDepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  async listAll(@Query() query: ListDepositsQueryDto) {
    return this.depositsService.listAllDeposits(query.limit, query.offset);
  }

  @Post("credit")
  async credit(@CurrentAdmin() user: AuthenticatedAdmin, @Body() body: CreditDepositDto) {
    return this.depositsService.creditDeposit(user, body);
  }

  @Post("addresses")
  async assignAddress(@CurrentAdmin() user: AuthenticatedAdmin, @Body() body: AssignDepositAddressDto) {
    return this.depositsService.assignDepositAddress(user, body);
  }
}
