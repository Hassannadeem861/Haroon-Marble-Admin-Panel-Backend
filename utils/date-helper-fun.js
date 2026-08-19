/**
 * Date helpers — Pakistan (local, non-UTC-shifted) DD/MM/YYYY <-> Date.
 * Behavior preserved from existing helperFun.js: agar caller entryDate
 * bhejta hai to wahi use hoti hai, warna caller khud `new Date()` (aaj)
 * pass kare. Ye file sirf pure parse/format functions rakhti hai.
 */

const PAKISTAN_OFFSET_MINUTES = 5 * 60;

// "13/08/2026" or "13/08/2026 14:30" -> fixed Pakistan time
export const parseDDMMYYYY = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;

  const [datePart, timePart] = dateStr.trim().split(" ");
  const parts = datePart.split("/").map(Number);
  const [day, month, year] = parts;

  if (!day || !month || !year) return null;

  let hours = 0;
  let minutes = 0;
  if (timePart) {
    const [h, m] = timePart.split(":").map(Number);
    hours = h || 0;
    minutes = m || 0;
  }

  const date = new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - PAKISTAN_OFFSET_MINUTES * 60 * 1000,
  );

  // Reject invalid dates like 31/02/2026
  const pakistanDate = new Date(date.getTime() + PAKISTAN_OFFSET_MINUTES * 60 * 1000);
  if (
    pakistanDate.getUTCFullYear() !== year ||
    pakistanDate.getUTCMonth() !== month - 1 ||
    pakistanDate.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

// JS Date -> "13/08/2026" using fixed Pakistan time
export const formatToDDMMYYYY = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const pakistanDate = new Date(d.getTime() + PAKISTAN_OFFSET_MINUTES * 60 * 1000);
  const day = String(pakistanDate.getUTCDate()).padStart(2, "0");
  const month = String(pakistanDate.getUTCMonth() + 1).padStart(2, "0");
  const year = pakistanDate.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Resolve entryDate for create/update operations.
 * - Agar `entryDateStr` diya gaya hai, use parse karke return karo.
 * - Agar nahi diya (undefined/null/empty), to `fallback` return karo
 *   (create ke waqt fallback = aaj ki date, update ke waqt fallback =
 *   existing document ki entryDate — is tarah "already bani hui entry"
 *   ki date change nahi hoti jab tak explicitly nayi date na di jaye).
 * Throws a plain Error with `.status = 400` on invalid format.
 */
export const resolveEntryDate = (entryDateStr, fallback) => {
  if (entryDateStr === undefined || entryDateStr === null || entryDateStr === "") {
    return fallback;
  }
  const parsed = parseDDMMYYYY(entryDateStr);
  if (!parsed) {
    const err = new Error(
      "Invalid entryDate. Expected format: DD/MM/YYYY (e.g. 13/08/2026)",
    );
    err.status = 400;
    throw err;
  }
  return parsed;
};

// Build a local (non-UTC-shifted) start/end-of-day range for date filters.
export const dayRange = (dateStr) => {
  const start = parseDDMMYYYY(dateStr) || new Date(dateStr);
  if (Number.isNaN(start.getTime())) return null;
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const to = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
  return { from, to };
};