import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadFileDto {
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
