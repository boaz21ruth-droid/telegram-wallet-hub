import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsTonAddress } from "../../../common/validators/is-ton-address.validator";

export class AssignDepositAddressDto {
  @IsString()
  @IsNotEmpty()
  telegramUserId!: string;

  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  @IsTonAddress()
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  memo?: string;
}
