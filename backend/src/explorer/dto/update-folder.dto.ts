import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string | null;

  @IsOptional()
  @IsString()
  visibility?: string;
}
