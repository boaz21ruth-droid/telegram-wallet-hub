import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsAddressForNetwork } from "../../../common/validators/is-address-for-network.validator";

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsAddressForNetwork()
  toAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
