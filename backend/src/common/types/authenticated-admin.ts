import { AdminRole } from "@prisma/client";

export type AuthenticatedAdmin = {
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
  sessionId: string;
};
