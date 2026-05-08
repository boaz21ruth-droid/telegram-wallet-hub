import { Controller, Get, Query } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListDepositsQueryDto } from "./dto/list-deposits-query.dto";
import { DepositsService } from "./deposits.service";

@Controller("deposits")
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get("orders")
  async listOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: ListDepositsQueryDto) {
    return this.depositsService.listUserDeposits(user.id, query.limit, query.offset);
  }
}
