import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
