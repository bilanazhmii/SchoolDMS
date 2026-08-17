import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedProfile } from './auth.types';

@Injectable()
export class AuthService {
  private readonly supabase: ReturnType<typeof createClient>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseServiceRoleKey = this.config.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration is required for AuthService');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async validateAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedProfile> {
    if (!accessToken) {
      throw new UnauthorizedException('Authorization token is missing');
    }

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new UnauthorizedException('Invalid Supabase access token');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { supabaseAuthId: user.id },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) {
      throw new UnauthorizedException('User profile not found');
    }

    return profile;
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const {
      data: { session, user },
      error,
    } = await this.supabase.auth.signInWithPassword({ email, password });

    if (error || !session || !user) {
      throw new UnauthorizedException(
        error?.message ?? 'Invalid email or password',
      );
    }

    // Ensure a local profile exists for this Supabase user.
    await this.prisma.profile.upsert({
      where: { supabaseAuthId: user.id },
      update: {
        email: user.email ?? email,
        lastLogin: new Date(),
      },
      create: {
        supabaseAuthId: user.id,
        email: user.email ?? email,
        fullName: user.user_metadata?.full_name as string | undefined,
        lastLogin: new Date(),
      },
    });

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 3600,
      email: user.email ?? email,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const {
      data: { session, user },
      error,
    } = await this.supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !session || !user) {
      throw new UnauthorizedException(
        error?.message ?? 'Invalid refresh token',
      );
    }

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in ?? 3600,
      email: user.email ?? '',
    };
  }
}
