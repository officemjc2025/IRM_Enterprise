export interface ImportFile {
  name: string;
  size: number;
  type: string;
  rawFile: File;
}

export interface ImportRow {
  [key: string]: unknown;
}

export interface PreviewResult {
  headers: string[];
  rows: Record<string, unknown>[];
}
