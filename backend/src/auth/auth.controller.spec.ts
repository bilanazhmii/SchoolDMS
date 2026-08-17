import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  const service = {
    login: jest.fn(),
    refresh: jest.fn(),
    validateAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /auth/login delegates to AuthService.login', async () => {
    const tokens = {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
      email: 'a@b.c',
    };
    service.login.mockResolvedValue(tokens);

    const result = await controller.login({ email: 'a@b.c', password: 'x' });
    expect(service.login).toHaveBeenCalledWith('a@b.c', 'x');
    expect(result).toEqual(tokens);
  });

  it('POST /auth/refresh delegates to AuthService.refresh', async () => {
    const tokens = {
      accessToken: 'at2',
      refreshToken: 'rt2',
      expiresIn: 3600,
      email: 'a@b.c',
    };
    service.refresh.mockResolvedValue(tokens);

    const result = await controller.refresh({ refreshToken: 'rt' });
    expect(service.refresh).toHaveBeenCalledWith('rt');
    expect(result).toEqual(tokens);
  });
});
