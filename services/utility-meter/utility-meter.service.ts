import { SupabaseClient } from "@supabase/supabase-js";

export const utilityMeterService = {
  /**
   * Helper to format sequence number to 2 digits (e.g. 1 -> "01", 10 -> "10")
   */
  formatSequence(seq: number): string {
    return seq.toString().padStart(2, "0");
  },

  /**
   * Helper to get utility code abbreviation
   */
  getUtilityCode(utilityType: "WATER" | "ELECTRICITY"): string {
    return utilityType === "WATER" ? "WM" : "EM";
  },

  /**
   * Helper to format date string to YYYYMM
   */
  formatYearMonth(dateStr: string): string {
    if (!dateStr) {
      throw new Error("Date string is required to generate installed meter code");
    }
    // Match YYYY-MM-DD or YYYY-MM
    const match = dateStr.match(/^(\d{4})-(\d{2})/);
    if (!match) {
      throw new Error(`Invalid date format for installed meter: "${dateStr}". Expected YYYY-MM-DD or YYYY-MM`);
    }
    return `${match[1]}${match[2]}`;
  },

  /**
   * Generate Legacy Meter Code
   * Pattern: {UNIT_NUMBER}-{UTILITY_CODE}-LEGACY-{SEQUENCE_2_DIGITS}
   */
  generateLegacyMeterCode(unitNumber: string, utilityType: "WATER" | "ELECTRICITY", sequence: number): string {
    const uc = this.getUtilityCode(utilityType);
    const seqStr = this.formatSequence(sequence);
    return `${unitNumber.trim()}-${uc}-LEGACY-${seqStr}`;
  },

  /**
   * Generate Installed/Replacement Meter Code
   * Pattern: {UNIT_NUMBER}-{UTILITY_CODE}-{YYYYMM}-{SEQUENCE_2_DIGITS}
   */
  generateInstalledMeterCode(unitNumber: string, utilityType: "WATER" | "ELECTRICITY", installedAt: string, sequence: number): string {
    const uc = this.getUtilityCode(utilityType);
    const yyyymm = this.formatYearMonth(installedAt);
    const seqStr = this.formatSequence(sequence);
    return `${unitNumber.trim()}-${uc}-${yyyymm}-${seqStr}`;
  },

  /**
   * Resolve next sequence for a Unit and Utility Type (starts at 1)
   */
  async resolveNextMeterSequence(supabase: SupabaseClient, unitId: string, utilityType: "WATER" | "ELECTRICITY"): Promise<number> {
    if (!unitId) throw new Error("unitId is required to resolve sequence");
    if (!utilityType) throw new Error("utilityType is required to resolve sequence");

    // Fetch all historical meter numbers for this unit and utility type (active and inactive/retired)
    const { data, error } = await supabase
      .from("utility_meters")
      .select("meter_number")
      .eq("unit_id", unitId)
      .eq("utility_type", utilityType);

    if (error) {
      throw new Error(`Failed to resolve next meter sequence: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return 1;
    }

    let maxSeq = 0;
    for (const row of data) {
      const parts = row.meter_number.split("-");
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }

    return maxSeq + 1;
  }
};
