import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateFiatOrderDto {
  @IsString()
  @IsIn(["CNY", "USD"])
  fiatCurrency!: string;

  @IsString()
  @IsNotEmpty()
  fiatAmount!: string;

  @IsString()
  @IsOptional()
  assetCode?: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsString()
  @IsOptional()
  paymentMethodCode?: string;
}
