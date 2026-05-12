import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { WalletAdminService } from "./wallet-admin.service";

@Controller("admin/wallet")
@Public()
@UseGuards(AdminGuard)
export class AdminWalletController {
  constructor(private readonly walletAdminService: WalletAdminService) {}

  @Post("adjustments")
  async createAdjustment(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() body: CreateAdjustmentDto,
  ) {
    return this.walletAdminService.createAdjustment(admin, body);
  }

  @Get("stats")
  async getDashboardStats() {
    return this.walletAdminService.getDashboardStats();
  }

  @Get("audit-logs")
  async getAuditLogs(
    @Query("limit") limitStr?: string,
    @Query("offset") offsetStr?: string,
    @Query("resourceType") resourceType?: string,
  ) {
    const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 100);
    const offset = parseInt(offsetStr ?? "0", 10) || 0;
    if (limit < 1) throw new BadRequestException("limit must be >= 1");
    return this.walletAdminService.listAuditLogs(limit, offset, resourceType);
  }
}
