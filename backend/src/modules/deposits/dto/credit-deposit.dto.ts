import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreditDepositDto {
  @IsString()
  @IsNotEmpty()
  telegramUserId!: string;

  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  /** Credited amount (excluding fee) */
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  txHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
