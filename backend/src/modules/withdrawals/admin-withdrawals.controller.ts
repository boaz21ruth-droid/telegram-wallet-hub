import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListAdminWithdrawalsQueryDto } from "./dto/list-admin-withdrawals-query.dto";
import { ReviewWithdrawalDto } from "./dto/review-withdrawal.dto";
import { SignWithdrawalDto } from "./dto/sign-withdrawal.dto";
import { WithdrawalsService } from "./withdrawals.service";

@Controller("admin/withdrawals")
@UseGuards(AdminGuard)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  async listOrders(@Query() query: ListAdminWithdrawalsQueryDto) {
    return this.withdrawalsService.listAdminOrders(query.status);
  }

  @Post(":id/approve")
  async approveReview(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReviewWithdrawalDto,
  ) {
    return this.withdrawalsService.approveReview(id, user, body.note);
  }

  @Post(":id/reject")
  async rejectReview(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReviewWithdrawalDto,
  ) {
    return this.withdrawalsService.rejectReview(id, user, body.note);
  }

  @Post(":id/sign")
  async signWithdrawal(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SignWithdrawalDto,
  ) {
    return this.withdrawalsService.signWithdrawal(id, user, body.txHash);
  }

  @Post(":id/confirm")
  async confirmWithdrawal(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.withdrawalsService.confirmWithdrawal(id, user);
  }

  @Post(":id/fail")
  async failWithdrawal(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReviewWithdrawalDto,
  ) {
    return this.withdrawalsService.failWithdrawal(id, user, body.note);
  }
}
