import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { UserRole, UserType } from '@Common';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: (UserType | UserRole)[]) =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    return this.validateRoles(roles, user.type, user.role);
  }

  validateRoles(
    requiredRoles: string[],
    userType: string,
    userRole?: string,
  ): boolean {
    return requiredRoles.some((required) => {
      const r = required.toLowerCase();
      if (userType?.toLowerCase() === r) return true;
      if (userRole?.toLowerCase() === r) return true;
      return false;
    });
  }
}
