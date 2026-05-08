import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Request } from "express";

import { AuthenticatedUser } from "../types/authenticated-user";

type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (request.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Admin role is required");
    }

    return true;
  }
}
