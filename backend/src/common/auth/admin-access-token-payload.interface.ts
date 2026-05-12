import { AdminRole } from "@prisma/client";

export type AdminAccessTokenPayload = {
  sub: string;
  sessionId: string;
  role: AdminRole;
  username: string;
};
