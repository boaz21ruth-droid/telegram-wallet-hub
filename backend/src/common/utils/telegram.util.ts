import { createHmac, timingSafeEqual } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import { z } from "zod";

const telegramUserSchema = z.object({
  id: z.union([z.number(), z.string()]).transform((value) => String(value)),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  photo_url: z.string().optional(),
});

export type TelegramInitUser = z.infer<typeof telegramUserSchema>;

export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds: number): {
  authDate: Date;
  user: TelegramInitUser;
} {
  const searchParams = new URLSearchParams(initData);
  const hash = searchParams.get("hash");

  if (!hash) {
    throw new UnauthorizedException("Telegram initData hash is missing");
  }

  const dataCheckString = Array.from(searchParams.entries())
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!/^[a-f0-9]+$/i.test(hash)) {
    throw new UnauthorizedException("Telegram initData hash format is invalid");
  }

  if (computedHash.length !== hash.length) {
    throw new UnauthorizedException("Telegram initData hash length is invalid");
  }

  const expectedHash = Buffer.from(computedHash, "hex");
  const receivedHash = Buffer.from(hash, "hex");

  if (expectedHash.length !== receivedHash.length) {
    throw new UnauthorizedException("Telegram initData hash value is invalid");
  }

  const isValid = timingSafeEqual(expectedHash, receivedHash);

  if (!isValid) {
    throw new UnauthorizedException("Telegram initData signature is invalid");
  }

  const authDateRaw = searchParams.get("auth_date");

  if (!authDateRaw) {
    throw new UnauthorizedException("Telegram auth_date is missing");
  }

  const authDateSeconds = Number(authDateRaw);

  if (!Number.isFinite(authDateSeconds)) {
    throw new UnauthorizedException("Telegram auth_date is invalid");
  }

  const issuedAt = new Date(authDateSeconds * 1000);
  const now = Date.now();

  if (Math.abs(now - issuedAt.getTime()) > maxAgeSeconds * 1000) {
    throw new UnauthorizedException("Telegram initData is expired");
  }

  const userRaw = searchParams.get("user");

  if (!userRaw) {
    throw new UnauthorizedException("Telegram user payload is missing");
  }

  let parsedUser: unknown;

  try {
    parsedUser = JSON.parse(userRaw);
  } catch {
    throw new UnauthorizedException("Telegram user payload is not valid JSON");
  }

  const parsedTelegramUser = telegramUserSchema.safeParse(parsedUser);

  if (!parsedTelegramUser.success) {
    throw new UnauthorizedException("Telegram user payload shape is invalid");
  }

  return {
    authDate: issuedAt,
    user: parsedTelegramUser.data,
  };
}
