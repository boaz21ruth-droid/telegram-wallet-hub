import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";
import { Address } from "@ton/ton";

export function IsTonAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isTonAddress",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value !== "string" || value.trim() === "") return false;
          try {
            const addr = Address.parse(value);
            return addr.workChain === 0; // mainnet only, reject masterchain (-1)
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid TON mainnet address`;
        },
      },
    });
  };
}
