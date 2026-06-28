import { parseFile } from "@/features/import/utils/excelParser";

export const importService = {
  async readFile(file: File) {
    return parseFile(file);
  },

  async preview(file: File) {
    const parsed = await parseFile(file);
    return {
      headers: parsed.headers,
      rows: parsed.rows.slice(0, 20),
    };
  }
};
