import type {
  Permission,
  Profile,
  Role,
  RolePermission,
  UserRole,
} from '@prisma/client';

export type AuthenticatedRole = Role & {
  permissions: Array<RolePermission & { permission: Permission }>;
};

export type AuthenticatedUserRole = UserRole & {
  role: AuthenticatedRole;
};

export type AuthenticatedProfile = Profile & {
  roles: AuthenticatedUserRole[];
};

declare module 'express' {
  interface Request {
    user?: AuthenticatedProfile;
    accessToken?: string;
  }
}
