import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";

import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { ReviewKycDto } from "./dto/review-kyc.dto";
import { KycService } from "./kyc.service";

@Controller("admin/kyc")
@Public()
@UseGuards(AdminGuard)
export class AdminKycController {
  constructor(private readonly kycService: KycService) {}

  @Get()
  async listKyc(
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
  ) {
    const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 100);
    const offset = parseInt(offsetStr ?? "0", 10) || 0;
    if (limit < 1) throw new BadRequestException("limit must be >= 1");
    return this.kycService.listKyc(limit, offset);
  }

  @Get(":userId")
  async getKycByUser(@Param("userId") userId: string) {
    return this.kycService.getKycByUserId(userId);
  }

  @Patch(":userId/review")
  async reviewKyc(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param("userId") userId: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kycService.reviewKyc(admin, userId, dto.approved, dto.note);
  }
}
