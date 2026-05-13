import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewFiatOrderDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reviewerNote?: string;
}
