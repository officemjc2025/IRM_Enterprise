import * as XLSX from "xlsx";

export interface ParsedData {
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function parseFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          throw new Error("No data read from file");
        }

        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: null,
        });

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const sheetArrays = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
          header: 1,
          defval: "",
        });

        const headers = (sheetArrays[0] || []).map((h) => String(h).trim()).filter((h) => h !== "");

        resolve({
          headers,
          rows: jsonData,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsArrayBuffer(file);
  });
}
