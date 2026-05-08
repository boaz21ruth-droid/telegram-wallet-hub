import { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  telegramUserId: string;
  role: UserRole;
  sessionId: string;
};
