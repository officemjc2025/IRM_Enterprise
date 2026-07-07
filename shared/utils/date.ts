const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ENG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getBangkokParts(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  };

  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(d);
  
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const day = parseInt(map.day || "1");
  const month = parseInt(map.month || "1") - 1; // 0-indexed
  const year = parseInt(map.year || "2026");
  const hour = (map.hour || "0").padStart(2, "0");
  const minute = (map.minute || "0").padStart(2, "0");

  return { day, month, year, hour, minute };
}

export function formatDate(date: Date | string | null | undefined, locale: "th" | "en"): string {
  if (!date) return "-";
  const { day, month, year } = getBangkokParts(date);
  if (locale === "th") {
    const thaiYear = year + 543;
    return `${day} ${THAI_MONTHS[month]} ${thaiYear}`;
  } else {
    return `${day} ${ENG_MONTHS[month]} ${year}`;
  }
}

export function formatDateTime(date: Date | string | null | undefined, locale: "th" | "en"): string {
  if (!date) return "-";
  const { day, month, year, hour, minute } = getBangkokParts(date);
  if (locale === "th") {
    const thaiYear = year + 543;
    return `${day} ${THAI_MONTHS[month]} ${thaiYear} เวลา ${hour}:${minute} น.`;
  } else {
    return `${day} ${ENG_MONTHS[month]} ${year}, ${hour}:${minute}`;
  }
}

export function formatCompactDate(date: Date | string | null | undefined, locale: "th" | "en"): string {
  if (!date) return "-";
  const { day, month, year } = getBangkokParts(date);
  if (locale === "th") {
    const thaiYear = (year + 543) % 100;
    return `${day} ${THAI_MONTHS[month]} ${thaiYear}`;
  } else {
    const engYear = year % 100;
    return `${day} ${ENG_MONTHS[month]} ${engYear}`;
  }
}

export function formatMonthYear(date: Date | string | null | undefined, locale: "th" | "en"): string {
  if (!date) return "-";
  const { month, year } = getBangkokParts(date);
  if (locale === "th") {
    const thaiYear = year + 543;
    return `${THAI_MONTHS[month]} ${thaiYear}`;
  } else {
    return `${ENG_MONTHS[month]} ${year}`;
  }
}

// =====================================================
// Enum Translations
// =====================================================
export const translateReservationType = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "RENTAL_GUEST": return "ผู้เช่าหรือผู้เข้าพัก";
      case "OWNER_STAY": return "เจ้าของเข้าพัก";
      case "MANAGEMENT_USE": return "ใช้งานโดยฝ่ายบริหาร";
      case "OTHER": return "อื่น ๆ";
      default: return val;
    }
  }
  return val.replace("_", " ");
};

export const translateBillingBasis = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "MONTHLY": return "รายเดือน";
      case "DAILY": return "รายวัน";
      case "CUSTOM": return "ราคาพิเศษ";
      default: return val;
    }
  }
  return val;
};

export const translateReservationStatus = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "DRAFT": return "ร่าง";
      case "PENDING_CONFIRMATION": return "รอยืนยัน";
      case "CONFIRMED": return "ยืนยันแล้ว";
      case "CHECKED_IN": return "เข้าพักแล้ว";
      case "CHECKED_OUT": return "ออกจากห้องแล้ว";
      case "CANCELLED": return "ยกเลิก";
      case "NO_SHOW": return "ไม่เข้าพักตามกำหนด";
      default: return val;
    }
  }
  return val.replace("_", " ");
};

export const translateExtensionPricing = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "HALF_MONTH": return "ครึ่งเดือน";
      case "DAILY_PRORATE": return "คิดตามจำนวนวัน";
      case "FULL_MONTH": return "เต็มเดือน";
      case "CUSTOM": return "ราคาพิเศษ";
      default: return val;
    }
  }
  return val.replace("_", " ");
};

export const translatePaymentStatus = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "NOT_READY": return "ข้อมูลยังไม่ครบ";
      case "PENDING": return "รอชำระ";
      case "PARTIALLY_PAID": return "ชำระบางส่วน";
      case "PAID": return "ชำระแล้ว";
      case "OVERDUE": return "เกินกำหนดชำระ";
      case "WAIVED": return "ยกเว้นการเรียกเก็บ";
      case "CANCELLED": return "ยกเลิก";
      default: return val;
    }
  }
  return val.replace("_", " ");
};

export const translateUtilityStatus = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "PENDING": return "รอข้อมูล";
      case "READY": return "พร้อมเรียกเก็บ";
      case "PAID": return "ชำระแล้ว";
      default: return val;
    }
  }
  return val;
};

export const translateAttention = (val: string, locale: "th" | "en") => {
  if (locale === "th") {
    switch (val) {
      case "RENT_DUE_SOON": return "ใกล้ครบกำหนดชำระ";
      case "RENT_DUE_TODAY": return "ครบกำหนดชำระวันนี้";
      case "RENT_OVERDUE": return "ค้างชำระค่าเช่า";
      case "PARTIAL_PAYMENT": return "ชำระบางส่วน";
      case "WATER_PENDING": return "รอมิเตอร์ค่าน้ำ";
      case "ELECTRICITY_PENDING": return "รอมิเตอร์ค่าไฟ";
      case "UTILITIES_INCOMPLETE": return "ค่าน้ำค่าไฟยังไม่ครบถ้วน";
      case "EXTENSION_PENDING": return "รออนุมัติขยายระยะเวลา";
      case "UPCOMING_CHECKOUT": return "สิ้นสุดสัญญาสัปดาห์นี้";
      case "CHECKOUT_OVERDUE": return "เลยวันย้ายออก";
      case "ACTION_REQUIRED": return "ต้องดำเนินการ";
      case "NORMAL": return "ปกติ";
       // Reservation attentions
      case "PENDING_CONFIRMATION": return "รอยืนยันใบจอง";
      case "UPCOMING_CHECK_IN": return "เช็คอินเร็วๆ นี้";
      case "CURRENTLY_IN_HOUSE": return "อยู่ในห้องพัก";
      case "CANCELLED": return "ยกเลิกแล้ว";
      case "NO_SHOW": return "ไม่แสดงตัว";
      case "PREP_REQUIRED": return "รอเตรียมห้องพัก";
      default: return val;
    }
  }
  if (val === "ACTION_REQUIRED") return "Action Required";
  return val === "PREP_REQUIRED" ? "Prep Required" : val.replace("_", " ");
};
