import { IsDateString, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { KycIdType } from "@prisma/client";

export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  realName: string;

  @IsEnum(KycIdType)
  idType: KycIdType;

  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsDateString()
  birthDate: string;
}
