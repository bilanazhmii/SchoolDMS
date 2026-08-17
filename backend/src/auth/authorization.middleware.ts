import type { NextFunction, Request, Response } from 'express';

import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class AuthorizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return next();
    }

    const token = authorization.replace('Bearer ', '').trim();
    if (token) {
      (req as unknown as { accessToken?: string }).accessToken = token;
    }

    next();
  }
}
