import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateAdjustmentDto } from "./dto/create-adjustment.dto";
import { WalletAdminService } from "./wallet-admin.service";

@Controller("admin/wallet")
@UseGuards(AdminGuard)
export class AdminWalletController {
  constructor(private readonly walletAdminService: WalletAdminService) {}

  @Post("adjustments")
  async createAdjustment(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() body: CreateAdjustmentDto,
  ) {
    return this.walletAdminService.createAdjustment(admin, body);
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
