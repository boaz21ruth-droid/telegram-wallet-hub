import * as path from "path";

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";

import { env } from "../../config/env";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { SubmitKycDto } from "./dto/submit-kyc.dto";
import { KycService } from "./kyc.service";

@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post("submit")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "frontImage", maxCount: 1 },
        { name: "backImage", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_, __, cb) => {
            cb(null, path.join(path.resolve(env().UPLOAD_DIR), "kyc"));
          },
          filename: (_, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
          },
        }),
        fileFilter: (_, file, cb) => {
          if (!file.mimetype.startsWith("image/")) {
            cb(new BadRequestException("Only image files are allowed"), false);
          } else {
            cb(null, true);
          }
        },
        limits: { fileSize: 10 * 1024 * 1024 },
      },
    ),
  )
  async submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitKycDto,
    @UploadedFiles() files: { frontImage?: Express.Multer.File[]; backImage?: Express.Multer.File[] },
  ) {
    const frontFile = files?.frontImage?.[0];
    if (!frontFile) throw new BadRequestException("frontImage is required");

    const frontPath = path.join("kyc", frontFile.filename);
    const backPath = files?.backImage?.[0] ? path.join("kyc", files.backImage[0].filename) : undefined;

    return this.kycService.submitKyc(user.id, dto, frontPath, backPath);
  }

  @Get()
  async getMyKyc(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getMyKyc(user.id);
  }
}
