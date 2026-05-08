import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
import { IsAddressForNetwork } from "../../../common/validators/is-address-for-network.validator";

export class CreateTransferDto {
  @ValidateIf((o: CreateTransferDto) => !o.recipientAddress)
  @IsString()
  @IsNotEmpty()
  recipientTelegramUserId?: string;

  @ValidateIf((o: CreateTransferDto) => !o.recipientTelegramUserId)
  @IsString()
  @IsNotEmpty()
  @IsAddressForNetwork()
  recipientAddress?: string;

  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsString()
  @IsNotEmpty()
  network!: string;

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  bizNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
