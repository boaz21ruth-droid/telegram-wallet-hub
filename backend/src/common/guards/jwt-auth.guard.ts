import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { env } from "../../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { AccessTokenPayload } from "../auth/access-token-payload.interface";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthenticatedUser } from "../types/authenticated-user";

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      throw new UnauthorizedException("Bearer token is empty");
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: env().JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Token is invalid");
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Session is expired");
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("User is not active");
    }

    request.user = {
      id: session.user.id,
      telegramUserId: session.user.telegramUserId,
      role: session.user.role,
      sessionId: session.id,
    };

    return true;
  }
}
