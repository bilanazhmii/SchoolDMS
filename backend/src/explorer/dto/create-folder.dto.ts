import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUUID()
  parentFolderId?: string | null;

  @IsOptional()
  @IsString()
  visibility?: string;
}
