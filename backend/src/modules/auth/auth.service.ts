import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, UserRole } from "@prisma/client";

import { env } from "../../config/env";
import { supportedAssets } from "../../config/supported-assets";
import { PrismaService } from "../../common/prisma/prisma.service";
import { validateTelegramInitData } from "../../common/utils/telegram.util";

type LoginContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async loginWithTelegram(initData: string, context: LoginContext) {
    const validated = validateTelegramInitData(
      initData,
      env().TELEGRAM_BOT_TOKEN,
      env().TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
    );
    const telegramUserId = validated.user.id;

    const { user, session } = await this.prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.upsert({
        where: { telegramUserId },
        update: {
          username: validated.user.username,
          firstName: validated.user.first_name,
          lastName: validated.user.last_name,
          photoUrl: validated.user.photo_url,
        },
        create: {
          telegramUserId,
          username: validated.user.username,
          firstName: validated.user.first_name,
          lastName: validated.user.last_name,
          photoUrl: validated.user.photo_url,
          role: UserRole.USER,
        },
      });

      await tx.walletAccount.createMany({
        data: supportedAssets.map((asset) => ({
          userId: userRecord.id,
          assetCode: asset.assetCode,
          network: asset.network,
        })),
        skipDuplicates: true,
      });

      const sessionRecord = await tx.authSession.create({
        data: {
          userId: userRecord.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          telegramAuthDate: validated.authDate,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const freshUser = await tx.user.findUniqueOrThrow({
        where: { id: userRecord.id },
        include: {
          walletAccounts: {
            orderBy: [{ assetCode: "asc" }, { network: "asc" }],
          },
        },
      });

      return {
        user: freshUser,
        session: sessionRecord,
      };
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sessionId: session.id,
      role: user.role,
      telegramUserId: user.telegramUserId,
    });

    return {
      accessToken,
      user: this.serializeUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        walletAccounts: {
          orderBy: [{ assetCode: "asc" }, { network: "asc" }],
        },
      },
    });

    return this.serializeUser(user);
  }

  /**
   * Dev-only: create/login a test user without Telegram validation.
   * Throws in production.
   */
  async devLogin(testUserId: string, context: LoginContext) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Dev login is disabled in production");
    }

    const telegramUserId = `dev_${testUserId}`;

    const { user, session } = await this.prisma.$transaction(async (tx) => {
      const userRecord = await tx.user.upsert({
        where: { telegramUserId },
        update: { firstName: `Dev ${testUserId}` },
        create: {
          telegramUserId,
          firstName: `Dev`,
          lastName: testUserId,
          username: `dev_${testUserId}`,
          role: UserRole.USER,
        },
      });

      await tx.walletAccount.createMany({
        data: supportedAssets.map((asset) => ({
          userId: userRecord.id,
          assetCode: asset.assetCode,
          network: asset.network,
        })),
        skipDuplicates: true,
      });

      const sessionRecord = await tx.authSession.create({
        data: {
          userId: userRecord.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const freshUser = await tx.user.findUniqueOrThrow({
        where: { id: userRecord.id },
        include: {
          walletAccounts: { orderBy: [{ assetCode: "asc" }, { network: "asc" }] },
        },
      });

      return { user: freshUser, session: sessionRecord };
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sessionId: session.id,
      role: user.role,
      telegramUserId: user.telegramUserId,
    });

    return { accessToken, user: this.serializeUser(user) };
  }

  async logout(sessionId: string) {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  private serializeUser(
    user: Prisma.UserGetPayload<{
      include: {
        walletAccounts: true;
      };
    }>,
  ) {
    return {
      id: user.id,
      telegramUserId: user.telegramUserId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      role: user.role,
      status: user.status,
      kycStatus: user.kycStatus,
      walletAccounts: user.walletAccounts.map((account) => ({
        id: account.id,
        assetCode: account.assetCode,
        network: account.network,
        availableBalance: account.availableBalance,
        frozenBalance: account.frozenBalance,
        status: account.status,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
