import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { PERMISSIONS_KEY } from './auth.constants';
import { Permission } from './permission.enum';

export const Permissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ApiOperation({
      summary: `Requires permissions: ${permissions.join(', ')}`,
    }),
  );
