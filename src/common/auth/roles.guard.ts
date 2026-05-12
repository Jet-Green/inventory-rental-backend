import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "./roles.decorator";
import type { AuthUser, Role } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as any).user as AuthUser | undefined;

    const roles = user?.roles || [];
    const ok = requiredRoles.some((role) => roles.includes(role));
    if (!ok) {
      throw new ForbiddenException("Недостаточно прав");
    }
    return true;
  }
}

