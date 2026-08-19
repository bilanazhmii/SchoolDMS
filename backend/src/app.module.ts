import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthExamplesController } from './auth/auth.controller.examples';
import { AuthModule } from './auth/auth.module';
import { AuthorizationMiddleware } from './auth/authorization.middleware';
import { validateEnv } from './config/env.validation';
import { DriveModule } from './drive/drive.module';
import { ExplorerModule } from './explorer/explorer.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { SharingModule } from './sharing/sharing.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    DriveModule,
    StorageModule,
    // Explorer features (folders/files)
    ExplorerModule,
    // Public share links & guest view
    SharingModule,
  ],
  controllers: [AppController, AuthExamplesController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthorizationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
