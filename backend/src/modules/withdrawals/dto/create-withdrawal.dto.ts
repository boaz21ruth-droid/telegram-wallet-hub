import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsTonAddress } from "../../../common/validators/is-ton-address.validator";

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

  @IsTonAddress()
  toAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
