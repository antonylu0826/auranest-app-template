import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.ADMIN]: 100,
  [UserRole.USER]: 10,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<{ user?: { role?: UserRole } }>();
    if (!user?.role) throw new ForbiddenException();

    const userLevel = ROLE_LEVEL[user.role] ?? 0;
    if (!required.some((r) => userLevel >= ROLE_LEVEL[r])) throw new ForbiddenException();
    return true;
  }
}
