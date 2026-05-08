import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function parsePositiveDecimal(value: string, fieldName = "amount"): Prisma.Decimal {
  let decimal: Prisma.Decimal;

  try {
    decimal = new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid decimal`);
  }

  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new BadRequestException(`${fieldName} must be greater than zero`);
  }

  return decimal;
}

export function parseDecimal(value: string, fieldName = "amount"): Prisma.Decimal {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid decimal`);
  }
}
