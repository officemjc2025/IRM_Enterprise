/**
 * Formats the condominium common-fee allocation ratio.
 * Display format: comma-separated with two decimal places (e.g. 1,575.00).
 * Never appends a "%" symbol.
 */
export function formatOwnershipRatio(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  const num = Number(value);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Natural sorting comparison for Unit Numbers.
 * Group 1: Standard numeric slash Unit Numbers (e.g. 420/1, 420/2) sorted by numeric prefix, then numeric suffix.
 * Group 2: Other alphanumeric Unit Numbers (e.g. C001, C002) sorted alphanumerically.
 * Group 1 comes before Group 2.
 */
export function compareUnitNumbers(a: string | null | undefined, b: string | null | undefined): number {
  const strA = (a || "").trim();
  const strB = (b || "").trim();

  const regex = /^\d+\/\d+$/;
  const isAStandard = regex.test(strA);
  const isBStandard = regex.test(strB);

  if (isAStandard && isBStandard) {
    const [prefA, suffA] = strA.split("/").map(Number);
    const [prefB, suffB] = strB.split("/").map(Number);

    if (prefA !== prefB) {
      return prefA - prefB;
    }
    return suffA - suffB;
  }

  // Group 1 comes before Group 2
  if (isAStandard && !isBStandard) return -1;
  if (!isAStandard && isBStandard) return 1;

  // Group 2 natural alphanumeric comparison
  return strA.localeCompare(strB, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
