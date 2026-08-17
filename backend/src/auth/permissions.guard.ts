import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from './auth.constants';
import { Permission } from './permission.enum';
import type { AuthenticatedProfile } from './auth.types';

interface AuthenticatedRequest {
  user: AuthenticatedProfile;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.get<Permission[]>(PERMISSIONS_KEY, context.getHandler()) ||
      [];
    if (!requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const permissionNames = user.roles.flatMap((userRole) =>
      userRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    );

    const hasPermission = requiredPermissions.every((permission) =>
      permissionNames.includes(permission),
    );
    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permission privileges');
    }

    return true;
  }
}
