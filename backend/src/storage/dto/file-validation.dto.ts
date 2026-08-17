/**
 * Allowed file types for upload.
 * Can be extended based on organizational requirements.
 */
export enum FileType {
  // Documents
  PDF = 'application/pdf',
  DOC = 'application/msword',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS = 'application/vnd.ms-excel',
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT = 'application/vnd.ms-powerpoint',
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  TXT = 'text/plain',
  RTF = 'application/rtf',
  ODT = 'application/vnd.oasis.opendocument.text',
  ODS = 'application/vnd.oasis.opendocument.spreadsheet',
  ODP = 'application/vnd.oasis.opendocument.presentation',

  // Images
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  GIF = 'image/gif',
  WEBP = 'image/webp',
  SVG = 'image/svg+xml',
  BMP = 'image/bmp',
  TIFF = 'image/tiff',

  // Audio
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  OGG = 'audio/ogg',
  M4A = 'audio/mp4',

  // Video
  MP4 = 'video/mp4',
  AVI = 'video/x-msvideo',
  MOV = 'video/quicktime',
  WMV = 'video/x-ms-wmv',
  WEBM = 'video/webm',

  // Archives
  ZIP = 'application/zip',
  RAR = 'application/vnd.rar',
  TAR = 'application/x-tar',
  GZIP = 'application/gzip',
  '7Z' = 'application/x-7z-compressed',

  // Code
  JSON = 'application/json',
  XML = 'application/xml',
  YAML = 'application/x-yaml',
  CSV = 'text/csv',

  // Executables (blocked by default)
  EXE = 'application/x-msdownload',
  BAT = 'application/x-bat',
  SH = 'application/x-sh',
}

/**
 * File validation configuration.
 * Used to enforce upload limits and restrictions.
 */
export class FileValidationConfig {
  /**
   * Maximum file size in bytes.
   * Default: 100MB
   */
  maxSize: number = 100 * 1024 * 1024;

  /**
   * Allowed file types.
   * If null, all types are allowed (not recommended for production).
   */
  allowedTypes: FileType[] | null = null;

  /**
   * Blocked file types (blacklist approach).
   * Takes precedence over allowedTypes if both are specified.
   */
  blockedTypes: FileType[] = [
    FileType.EXE, // Executables
    FileType.BAT, // Batch files
    FileType.SH, // Shell scripts
  ];

  /**
   * Whether to validate file signature (magic numbers).
   * Provides security against MIME type spoofing.
   */
  validateSignature: boolean = true;

  /**
   * Maximum filename length.
   */
  maxFilenameLength: number = 255;

  /**
   * Blocked filename patterns (regex).
   */
  blockedPatterns: RegExp[] = [
    /^\./, // Hidden files
    /[<>:"|?*]/, // Invalid Windows characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Reserved Windows names
  ];
}

/**
 * File validation result.
 */
export class FileValidationResult {
  valid: boolean = true;
  errors: string[] = [];
}

/**
 * File validation utility.
 */
export class FileValidator {
  private config: FileValidationConfig;

  constructor(config: FileValidationConfig = new FileValidationConfig()) {
    this.config = config;
  }

  /**
   * Validates a file for upload.
   */
  validate(
    filename: string,
    mimeType: string,
    size: number,
  ): FileValidationResult {
    const errors: string[] = [];

    // Check filename length
    if (filename.length > this.config.maxFilenameLength) {
      errors.push(
        `Filename exceeds maximum length of ${this.config.maxFilenameLength}`,
      );
    }

    // Check blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(filename)) {
        errors.push(`Filename contains invalid characters or patterns`);
        break;
      }
    }

    // Check file size
    if (size > this.config.maxSize) {
      const maxSizeMB = Math.round(this.config.maxSize / (1024 * 1024));
      errors.push(`File size exceeds maximum of ${maxSizeMB}MB`);
    }

    // Check MIME type
    if (this.config.blockedTypes.includes(mimeType as FileType)) {
      errors.push(`File type ${mimeType} is not allowed`);
    }

    if (
      this.config.allowedTypes &&
      !this.config.allowedTypes.includes(mimeType as FileType)
    ) {
      errors.push(`File type ${mimeType} is not in the allowed list`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitizes a filename to prevent filesystem issues.
   */
  sanitizeFilename(filename: string): string {
    // Remove path traversal attempts
    let sanitized = filename.replace(/\.\./g, '').replace(/[/\\]/g, '_');

    // Remove invalid characters
    sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');

    // Limit length
    if (sanitized.length > this.config.maxFilenameLength) {
      const ext = sanitized.includes('.')
        ? sanitized.substring(sanitized.lastIndexOf('.'))
        : '';
      const name = sanitized.substring(
        0,
        this.config.maxFilenameLength - ext.length,
      );
      sanitized = name + ext;
    }

    // Fallback if filename becomes empty
    if (!sanitized) {
      sanitized = `file_${Date.now()}`;
    }

    return sanitized;
  }
}
