import { BadRequestException, Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { TelegramLoginDto } from "./dto/telegram-login.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("telegram/login")
  @Public()
  async login(@Body() body: TelegramLoginDto, @Req() request: Request) {
    return this.authService.loginWithTelegram(body.initData, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent") ?? undefined,
    });
  }

  @Get("me")
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Post("logout")
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.sessionId);
  }

  /** Only available when NODE_ENV !== "production" */
  @Post("dev/login")
  @Public()
  async devLogin(@Body() body: { userId?: string }, @Req() request: Request) {
    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException("Not available in production");
    }
    const testUserId = (body.userId ?? "user1").replace(/[^a-z0-9_]/gi, "").slice(0, 20) || "user1";
    return this.authService.devLogin(testUserId, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent") ?? undefined,
    });
  }
}
