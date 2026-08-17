import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedProfile } from '../../auth/auth.types';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UploadFileDto } from '../dto/upload-file.dto';
import { FileService } from './file.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('files')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FileController {
  constructor(private service: FileService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata and versions' })
  async get(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.get(user.id, id) };
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiOperation({ summary: 'Upload one or more files' })
  async upload(
    @CurrentUser() user: AuthenticatedProfile,
    @UploadedFiles() files: UploadedFile[],
    @Body() body: UploadFileDto,
    @Query('folderId') folderId?: string,
  ) {
    const uploaded: unknown[] = [];
    const uploadList = Array.isArray(files) ? files : files ? [files] : [];

    for (const file of uploadList) {
      const result = await this.service.upload(
        user.id,
        {
          name: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          buffer: file.buffer,
        },
        folderId ?? body.folderId,
      );
      uploaded.push(result);
    }

    return { success: true, data: uploaded };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  async download(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.service.download(user.id, id);

    if (result.drive) {
      // For Google Drive files, return the info for client-side download
      return res.json({ success: true, data: result });
    }

    // For local files, stream the buffer
    const buffer = result.buffer as Buffer;
    const fileName = encodeURIComponent(result.fileName);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    res.send(buffer);
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream file (for large files)' })
  async stream(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.service.getStream(user.id, id);

    if (result.drive) {
      // For Google Drive files, return the info for client-side streaming
      return res.json({ success: true, data: result });
    }

    // For local files, pipe the stream
    const stream = result.stream;
    if (!stream) {
      return res
        .status(500)
        .json({ success: false, message: 'Stream not available' });
    }

    const fileName = encodeURIComponent(result.fileName);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    stream.pipe(res);

    // Handle stream errors
    stream.on('error', (error) => {
      this.service['logger'].error(`Stream error for file ${id}`, error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Stream error' });
      }
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete file' })
  async remove(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.softDelete(user.id, id) };
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore file' })
  async restore(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.restore(user.id, id) };
  }

  @Post(':id/move')
  @ApiOperation({ summary: 'Move file to another folder' })
  async move(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Body() body: { toFolderId?: string | null },
  ) {
    return {
      success: true,
      data: await this.service.move(user.id, id, body.toFolderId),
    };
  }

  @Post(':id/copy')
  @ApiOperation({ summary: 'Copy file to another folder' })
  async copy(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
    @Body() body: { toFolderId?: string | null },
  ) {
    return {
      success: true,
      data: await this.service.copy(user.id, id, body.toFolderId),
    };
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List versions for a file' })
  async versions(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return {
      success: true,
      data: await this.service.listVersions(user.id, id),
    };
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Get preview for file' })
  async preview(
    @CurrentUser() user: AuthenticatedProfile,
    @Param('id') id: string,
  ) {
    return { success: true, data: await this.service.preview(user.id, id) };
  }
}
