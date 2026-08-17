import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

describe('FolderController', () => {
  let controller: FolderController;
  const service = {
    rootFolders: jest.fn(),
    getContents: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  };

  const user = { id: 'u1' } as never;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FolderController],
      providers: [{ provide: FolderService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(FolderController);
    jest.clearAllMocks();
  });

  it('GET /folders/root/contents delegates to getContents with no folderId', async () => {
    service.getContents.mockResolvedValue({ folders: [], files: [] });
    const result = await controller.rootContents(user, '1', '50');
    expect(service.getContents).toHaveBeenCalledWith('u1', undefined, 1, 50);
    expect(result).toEqual({ success: true, data: { folders: [], files: [] } });
  });

  it('GET /folders/:id/contents delegates to getContents with the folderId', async () => {
    service.getContents.mockResolvedValue({ folders: [], files: [] });
    const result = await controller.contents(user, 'f1');
    expect(service.getContents).toHaveBeenCalledWith('u1', 'f1', 1, 50);
    expect(result.success).toBe(true);
  });
});
