import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ReviewKycDto {
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  approved: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
