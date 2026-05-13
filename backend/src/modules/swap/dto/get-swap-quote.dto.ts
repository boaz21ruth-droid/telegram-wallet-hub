import { IsNotEmpty, IsString } from "class-validator";

export class GetSwapQuoteDto {
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
}
