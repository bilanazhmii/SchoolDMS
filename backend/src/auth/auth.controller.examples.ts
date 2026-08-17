import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Permission } from './permission.enum';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { Role } from './role.enum';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth/examples')
export class AuthExamplesController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin-only')
  @ApiOkResponse({ description: 'Accessible only to ADMIN users.' })
  adminOnly(@CurrentUser() user: AuthenticatedProfile) {
    return { message: `Hello ADMIN ${user.email}` };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.MANAGE_USERS)
  @Get('manage-users')
  @ApiOkResponse({
    description: 'Accessible only to users with MANAGE_USERS permission.',
  })
  manageUsers(@CurrentUser() user: AuthenticatedProfile) {
    return { message: `User ${user.email} may manage users.` };
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(Role.SUPPORT)
  @Permissions(Permission.VIEW_AUDIT_LOGS)
  @Get('support-audit')
  @ApiOkResponse({
    description: 'Accessible to SUPPORT users with audit access.',
  })
  supportAudit(@CurrentUser() user: AuthenticatedProfile) {
    return { message: `Support agent ${user.email} may view audit logs.` };
  }
}
