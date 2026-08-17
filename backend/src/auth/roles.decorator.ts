import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { ROLES_KEY } from './auth.constants';
import { Role } from './role.enum';

export const Roles = (...roles: Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiOperation({ summary: `Requires roles: ${roles.join(', ')}` }),
  );
