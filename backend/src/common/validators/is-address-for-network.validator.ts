import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { Address } from "@ton/ton";

@ValidatorConstraint({ name: "isAddressForNetwork", async: false })
export class IsAddressForNetworkConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    const { network } = args.object as { network?: string };
    if (!value || !network) return false;
    if (network === "TON") {
      try {
        return Address.parse(value).workChain === 0;
      } catch {
        return false;
      }
    }
    if (network === "TRC20") {
      return /^T[A-Za-z0-9]{33}$/.test(value);
    }
    return false;
  }

  defaultMessage() {
    return "无效的收款地址格式";
  }
}

export function IsAddressForNetwork(options?: ValidationOptions) {
  return (obj: object, prop: string) =>
    registerDecorator({
      target: obj.constructor,
      propertyName: prop,
      options,
      validator: IsAddressForNetworkConstraint,
    });
}
