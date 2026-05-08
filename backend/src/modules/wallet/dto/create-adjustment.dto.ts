import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  telegramUserId!: string;

  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  /**
   * Positive to credit, negative to debit.
   * e.g. "10.5" adds 10.5, "-5" deducts 5.
   */
  @IsString()
  @IsNotEmpty()
  delta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
