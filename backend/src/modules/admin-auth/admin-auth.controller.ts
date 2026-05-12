import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { AdminLoginDto } from "./dto/admin-login.dto";
import { AdminAuthService } from "./admin-auth.service";

@Controller("admin-auth")
@Public()
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  async login(@Body() body: AdminLoginDto, @Req() request: Request) {
    return this.adminAuthService.login(body.username, body.password, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent") ?? undefined,
    });
  }

  @Get("me")
  @UseGuards(AdminGuard)
  async getMe(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminAuthService.getMe(admin.id);
  }

  @Post("logout")
  @UseGuards(AdminGuard)
  async logout(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminAuthService.logout(admin.sessionId);
  }
}
