import { UserRole } from "@prisma/client";

export type AccessTokenPayload = {
  sub: string;
  sessionId: string;
  role: UserRole;
  telegramUserId: string;
};
