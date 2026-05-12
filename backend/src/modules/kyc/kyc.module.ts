import { Module } from "@nestjs/common";

import { PrismaModule } from "../../common/prisma/prisma.module";
import { AdminKycController } from "./admin-kyc.controller";
import { KycController } from "./kyc.controller";
import { KycService } from "./kyc.service";

@Module({
  imports: [PrismaModule],
  controllers: [KycController, AdminKycController],
  providers: [KycService],
})
export class KycModule {}
