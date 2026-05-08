import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SignWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  txHash!: string;
}
