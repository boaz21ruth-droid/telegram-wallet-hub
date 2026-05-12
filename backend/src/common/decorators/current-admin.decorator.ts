import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import { AuthenticatedAdmin } from "../types/authenticated-admin";

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAdmin => {
    const request = context.switchToHttp().getRequest<{ admin: AuthenticatedAdmin }>();
    return request.admin;
  },
);
