import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

import { env } from "../../config/env";
import { AdminAccessTokenPayload } from "../auth/admin-access-token-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedAdmin } from "../types/authenticated-admin";

type RequestWithAdmin = Request & {
  admin?: AuthenticatedAdmin;
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing admin bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException("Admin bearer token is empty");
    }

    let payload: AdminAccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AdminAccessTokenPayload>(token, {
        secret: env().ADMIN_JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Admin token is invalid");
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { id: payload.sessionId },
      include: { admin: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException("Admin session is expired");
    }

    if (!session.admin.isActive) {
      throw new UnauthorizedException("Admin account is inactive");
    }

    request.admin = {
      id: session.admin.id,
      username: session.admin.username,
      displayName: session.admin.displayName,
      role: session.admin.role,
      sessionId: session.id,
    };

    return true;
  }
}
