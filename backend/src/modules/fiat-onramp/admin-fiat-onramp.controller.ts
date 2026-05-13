import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { ReviewFiatOrderDto } from "./dto/review-fiat-order.dto";
import { FiatOnrampService } from "./fiat-onramp.service";

@Controller("admin/fiat-onramp")
@Public()
@UseGuards(AdminGuard)
export class AdminFiatOnrampController {
  constructor(private readonly fiatService: FiatOnrampService) {}

  @Get("orders")
  listOrders(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
  ) {
    return this.fiatService.listAdminOrders(limit ? Number(limit) : 50, offset ? Number(offset) : 0, status);
  }

  @Post("orders/:id/review-start")
  startReview(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string) {
    return this.fiatService.startReview(admin.id, id);
  }

  @Post("orders/:id/approve")
  approve(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string, @Body() body: ReviewFiatOrderDto) {
    return this.fiatService.approveOrder(admin.id, id, body.reviewerNote);
  }

  @Post("orders/:id/reject")
  reject(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string, @Body() body: ReviewFiatOrderDto) {
    return this.fiatService.rejectOrder(admin.id, id, body.reviewerNote);
  }
}
