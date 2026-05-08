import { IsEnum, IsOptional } from "class-validator";
import { WithdrawStatus } from "@prisma/client";

export class ListAdminWithdrawalsQueryDto {
  @IsOptional()
  @IsEnum(WithdrawStatus)
  status?: WithdrawStatus;
}
