import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto";
import { WithdrawalsService } from "./withdrawals.service";

@Controller("withdrawals")
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  async createWithdrawal(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateWithdrawalDto) {
    return this.withdrawalsService.createWithdrawal(user.id, user.telegramUserId, body);
  }

  @Get("orders")
  async listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawalsService.listOrders(user.id);
  }

  @Get("orders/:id")
  async getOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.withdrawalsService.getOrder(user.id, id);
  }

  @Post("orders/:id/cancel")
  async cancelWithdrawal(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.withdrawalsService.cancelWithdrawal(user.id, id);
  }
}
