import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditActorType, UserStatus } from "@prisma/client";

import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";

const USER_SELECT = {
  id: true,
  telegramUserId: true,
  username: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  role: true,
  status: true,
  kycStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: USER_SELECT,
    });
  }

  async listUsers(limit: number, offset: number) {
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        select: {
          ...USER_SELECT,
          _count: { select: { walletAccounts: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return { total, limit, offset, data: users };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        walletAccounts: {
          select: {
            id: true,
            assetCode: true,
            network: true,
            availableBalance: true,
            frozenBalance: true,
            status: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateUserStatus(targetUserId: string, status: UserStatus, adminUser: AuthenticatedAdmin) {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: USER_SELECT,
    });

    await this.prisma.auditLog.create({
      data: {
        actorType: AuditActorType.ADMIN,
        actorUserId: adminUser.id,
        action: `user.set_status.${status.toLowerCase()}`,
        resourceType: "user",
        resourceId: targetUserId,
        metadata: { previousStatus: user.status, newStatus: status },
      },
    });

    return updated;
  }
}
