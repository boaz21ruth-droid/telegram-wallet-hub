import { IsString, IsNotEmpty, IsNumberString, IsPositive, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class StakeAssetDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsNumberString()
  amount!: string;
}
