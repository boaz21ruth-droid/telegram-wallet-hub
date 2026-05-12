import * as fs from "fs";
import * as path from "path";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditActorType, KycStatus } from "@prisma/client";

import { env } from "../../config/env";
import { PrismaService } from "../../common/prisma/prisma.service";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { SubmitKycDto } from "./dto/submit-kyc.dto";

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async submitKyc(
    userId: string,
    dto: SubmitKycDto,
    frontImagePath: string,
    backImagePath?: string,
  ) {
    const existing = await this.prisma.kycApplication.findUnique({ where: { userId } });

    if (existing) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true } });
      if (user?.kycStatus === KycStatus.PENDING || user?.kycStatus === KycStatus.VERIFIED) {
        throw new BadRequestException("KYC application already submitted or verified");
      }
      // Delete old image files on resubmission
      this.deleteFileIfExists(existing.frontImagePath);
      if (existing.backImagePath) this.deleteFileIfExists(existing.backImagePath);
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await tx.kycApplication.upsert({
        where: { userId },
        create: {
          userId,
          realName: dto.realName,
          idType: dto.idType,
          idNumber: dto.idNumber,
          country: dto.country,
          birthDate: new Date(dto.birthDate),
          frontImagePath,
          backImagePath: backImagePath ?? null,
          reviewerId: null,
          reviewerNote: null,
          reviewedAt: null,
        },
        update: {
          realName: dto.realName,
          idType: dto.idType,
          idNumber: dto.idNumber,
          country: dto.country,
          birthDate: new Date(dto.birthDate),
          frontImagePath,
          backImagePath: backImagePath ?? null,
          reviewerId: null,
          reviewerNote: null,
          reviewedAt: null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: KycStatus.PENDING },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.USER,
          actorUserId: userId,
          action: "kyc.submit",
          resourceType: "kyc_application",
          resourceId: application.id,
          metadata: { idType: dto.idType, country: dto.country },
        },
      });

      return application;
    });
  }

  async getMyKyc(userId: string) {
    return this.prisma.kycApplication.findUnique({ where: { userId } });
  }

  async listKyc(limit: number, offset: number) {
    return this.prisma.kycApplication.findMany({
      include: {
        user: {
          select: { id: true, telegramUserId: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  async getKycByUserId(userId: string) {
    const app = await this.prisma.kycApplication.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, telegramUserId: true, username: true, firstName: true, lastName: true },
        },
      },
    });
    if (!app) throw new NotFoundException("KYC application not found");
    return app;
  }

  async reviewKyc(admin: AuthenticatedAdmin, userId: string, approved: boolean, note?: string) {
    const app = await this.prisma.kycApplication.findUnique({ where: { userId } });
    if (!app) throw new NotFoundException("KYC application not found");

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycStatus: true } });
    if (user?.kycStatus !== KycStatus.PENDING) {
      throw new BadRequestException("KYC application is not pending review");
    }

    const newStatus = approved ? KycStatus.VERIFIED : KycStatus.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.kycApplication.update({
        where: { userId },
        data: {
          reviewerId: admin.id,
          reviewerNote: note ?? null,
          reviewedAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, telegramUserId: true, username: true, firstName: true, lastName: true },
          },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycStatus: newStatus },
      });

      await tx.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorUserId: admin.id,
          action: approved ? "kyc.approve" : "kyc.reject",
          resourceType: "kyc_application",
          resourceId: app.id,
          metadata: { note, userId },
        },
      });

      return updated;
    });
  }

  private deleteFileIfExists(filePath: string) {
    const fullPath = path.join(path.resolve(env().UPLOAD_DIR), filePath);
    fs.unlink(fullPath, () => {});
  }
}
