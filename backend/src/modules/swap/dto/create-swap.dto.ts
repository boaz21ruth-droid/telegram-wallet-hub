import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateSwapDto {
  @IsString()
  @IsNotEmpty()
  fromAssetCode!: string;

  @IsString()
  @IsNotEmpty()
  fromNetwork!: string;

  @IsString()
  @IsNotEmpty()
  fromAmount!: string;

  @IsString()
  @IsNotEmpty()
  toAssetCode!: string;

  @IsString()
  @IsNotEmpty()
  toNetwork!: string;

  @IsString()
  @IsNotEmpty()
  minToAmount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  bizNo!: string;
}
