import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AdminAccount, AdminRole } from "@prisma/client";

import { PrismaService } from "../../common/prisma/prisma.service";
import { env } from "../../config/env";
import { hashPassword, verifyPassword } from "../../common/utils/password.util";

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminAuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.ensureBootstrapAdmin();
  }

  async login(username: string, password: string, context: LoginContext) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { username },
    });

    if (!admin || !admin.isActive || !verifyPassword(password, admin.passwordHash)) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    const session = await this.prisma.adminSession.create({
      data: {
        adminId: admin.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        sessionId: session.id,
        role: admin.role,
        username: admin.username,
      },
      {
        secret: env().ADMIN_JWT_SECRET,
        expiresIn: env().ADMIN_JWT_EXPIRES_IN,
      },
    );

    return {
      accessToken,
      admin: this.serializeAdmin(admin),
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.adminAccount.findUniqueOrThrow({
      where: { id: adminId },
    });

    return this.serializeAdmin(admin);
  }

  async logout(sessionId: string) {
    await this.prisma.adminSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  private async ensureBootstrapAdmin() {
    const configuredUsername = env().ADMIN_BOOTSTRAP_USERNAME;
    const configuredPassword = env().ADMIN_BOOTSTRAP_PASSWORD;

    const username =
      configuredUsername ?? (process.env.NODE_ENV === "production" ? undefined : "admin");
    const password =
      configuredPassword ?? (process.env.NODE_ENV === "production" ? undefined : "admin123456");

    if (!username || !password) return;

    const displayName =
      env().ADMIN_BOOTSTRAP_DISPLAY_NAME ??
      (process.env.NODE_ENV === "production" ? "Bootstrap Admin" : "Local Admin");
    const role = env().ADMIN_BOOTSTRAP_ROLE as AdminRole;
    const passwordHash = hashPassword(password);

    await this.prisma.adminAccount.upsert({
      where: { username },
      update: {
        passwordHash,
        displayName,
        role,
        isActive: true,
      },
      create: {
        username,
        passwordHash,
        displayName,
        role,
        isActive: true,
      },
    });
  }

  private serializeAdmin(admin: AdminAccount) {
    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }
}
