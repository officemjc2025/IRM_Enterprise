export interface UploadOptions {
  bucket: string;
  path: string;
  contentType?: string;
  cacheControl?: string;
}

export interface MediaProvider {
  uploadFile(file: Buffer | File | Blob, options: UploadOptions): Promise<string>;
  getPublicUrl(bucket: string, path: string): string;
  deleteFile(bucket: string, path: string): Promise<void>;
}
