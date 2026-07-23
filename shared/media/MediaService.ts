import { MediaProvider, UploadOptions } from "./MediaProvider";
import { SupabaseStorageProvider } from "./SupabaseStorageProvider";

class MediaService {
  private provider: MediaProvider;

  constructor(provider: MediaProvider = new SupabaseStorageProvider()) {
    this.provider = provider;
  }

  setProvider(provider: MediaProvider) {
    this.provider = provider;
  }

  async upload(file: Buffer | File | Blob, options: UploadOptions): Promise<string> {
    return this.provider.uploadFile(file, options);
  }

  getPublicUrl(bucket: string, path: string): string {
    return this.provider.getPublicUrl(bucket, path);
  }

  async delete(bucket: string, path: string): Promise<void> {
    return this.provider.deleteFile(bucket, path);
  }
}

export const mediaService = new MediaService();
export type { UploadOptions, MediaProvider };
