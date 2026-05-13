import { IsString, IsNotEmpty } from "class-validator";

export class RedeemStakingDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
