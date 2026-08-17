import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { FileModule } from './file/file.module';
import { FolderModule } from './folder/folder.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    FolderModule,
    FileModule,
    SearchModule,
  ],
  exports: [FolderModule, FileModule, SearchModule],
})
export class ExplorerModule {}
