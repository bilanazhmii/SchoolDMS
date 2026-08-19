export interface EnvironmentVariables {
  DATABASE_URL: string;
  DIRECT_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PORT?: string;
  NODE_ENV?: string;
  STORAGE_PATH?: string;
  STORAGE_DRIVER?: string;
  MAX_FILE_SIZE?: string;
  GOOGLE_DRIVE_CLIENT_ID?: string;
  GOOGLE_DRIVE_CLIENT_SECRET?: string;
  GOOGLE_DRIVE_REDIRECT_URI?: string;
  DRIVE_TOKEN_ENCRYPTION_KEY?: string;
  WEB_APP_URL?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const cleaned = {
    DATABASE_URL:
      typeof config.DATABASE_URL === 'string' ? config.DATABASE_URL.trim() : '',
    SUPABASE_URL:
      typeof config.SUPABASE_URL === 'string' ? config.SUPABASE_URL.trim() : '',
    SUPABASE_SERVICE_ROLE_KEY:
      typeof config.SUPABASE_SERVICE_ROLE_KEY === 'string'
        ? config.SUPABASE_SERVICE_ROLE_KEY.trim()
        : '',
    PORT: typeof config.PORT === 'string' ? config.PORT.trim() : undefined,
    NODE_ENV:
      typeof config.NODE_ENV === 'string' ? config.NODE_ENV.trim() : undefined,
    STORAGE_PATH:
      typeof config.STORAGE_PATH === 'string'
        ? config.STORAGE_PATH.trim()
        : undefined,
    STORAGE_DRIVER:
      typeof config.STORAGE_DRIVER === 'string'
        ? config.STORAGE_DRIVER.trim()
        : undefined,
    MAX_FILE_SIZE:
      typeof config.MAX_FILE_SIZE === 'string'
        ? config.MAX_FILE_SIZE.trim()
        : undefined,
    GOOGLE_DRIVE_CLIENT_ID:
      typeof config.GOOGLE_DRIVE_CLIENT_ID === 'string'
        ? config.GOOGLE_DRIVE_CLIENT_ID.trim()
        : undefined,
    GOOGLE_DRIVE_CLIENT_SECRET:
      typeof config.GOOGLE_DRIVE_CLIENT_SECRET === 'string'
        ? config.GOOGLE_DRIVE_CLIENT_SECRET.trim()
        : undefined,
    GOOGLE_DRIVE_REDIRECT_URI:
      typeof config.GOOGLE_DRIVE_REDIRECT_URI === 'string'
        ? config.GOOGLE_DRIVE_REDIRECT_URI.trim()
        : undefined,
    DRIVE_TOKEN_ENCRYPTION_KEY:
      typeof config.DRIVE_TOKEN_ENCRYPTION_KEY === 'string'
        ? config.DRIVE_TOKEN_ENCRYPTION_KEY.trim()
        : undefined,
    WEB_APP_URL:
      typeof config.WEB_APP_URL === 'string'
        ? config.WEB_APP_URL.trim()
        : undefined,
  };

  if (!cleaned.DATABASE_URL) {
    throw new Error(
      'Environment validation failed: DATABASE_URL must be defined',
    );
  }

  if (!cleaned.SUPABASE_URL) {
    throw new Error(
      'Environment validation failed: SUPABASE_URL must be defined',
    );
  }

  if (!cleaned.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Environment validation failed: SUPABASE_SERVICE_ROLE_KEY must be defined',
    );
  }

  return cleaned;
}
