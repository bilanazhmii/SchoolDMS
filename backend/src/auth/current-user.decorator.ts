import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedProfile } from './auth.types';

interface AuthenticatedRequest {
  user: AuthenticatedProfile;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedProfile | null => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user ?? null;
  },
);
