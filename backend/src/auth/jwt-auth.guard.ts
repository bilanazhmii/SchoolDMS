import { Request } from 'express';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import type { AuthenticatedProfile } from './auth.types';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedProfile;
  accessToken?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token =
      request.accessToken ??
      (authorization && authorization.startsWith('Bearer ')
        ? authorization.replace('Bearer ', '').trim()
        : undefined);

    if (!token) {
      throw new UnauthorizedException('Bearer token required');
    }

    const profile = await this.authService.validateAccessToken(token);
    request.user = profile;
    return true;
  }
}
