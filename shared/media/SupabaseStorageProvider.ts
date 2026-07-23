import { MediaProvider, UploadOptions } from "./MediaProvider";

export class SupabaseStorageProvider implements MediaProvider {
  async uploadFile(file: Buffer | File | Blob, options: UploadOptions): Promise<string> {
    // Scaffold: Supabase storage upload implementation in future sprint
    console.log("SupabaseStorageProvider uploadFile called", { options });
    return `https://supabase.placeholder.url/${options.bucket}/${options.path}`;
  }

  getPublicUrl(bucket: string, path: string): string {
    // Scaffold: Supabase storage getPublicUrl implementation in future sprint
    return `https://supabase.placeholder.url/${bucket}/${path}`;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    // Scaffold: Supabase storage deleteFile implementation in future sprint
    console.log("SupabaseStorageProvider deleteFile called", { bucket, path });
  }
}
