import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsAddressForNetwork } from "../../../common/validators/is-address-for-network.validator";

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

  @IsAddressForNetwork()
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  memo?: string;
}
