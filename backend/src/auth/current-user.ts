import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AgeBand, StaffRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  ageBand: AgeBand;
  role: StaffRole;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
