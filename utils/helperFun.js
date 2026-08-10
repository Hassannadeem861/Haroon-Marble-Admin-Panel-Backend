
// Converts "10/08/2026" or "10/08/2026 14:30" -> JS Date object
export const parseDDMMYYYY = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;

  const [datePart, timePart] = dateStr.trim().split(" ");
  const [day, month, year] = datePart.split("/").map(Number);

  if (!day || !month || !year) return null;

  let hours = 0, minutes = 0;
  if (timePart) {
    const [h, m] = timePart.split(":").map(Number);
    hours = h || 0;
    minutes = m || 0;
  }

  const date = new Date(year, month - 1, day, hours, minutes);

  // Validate ke actual valid date bani (e.g. 31/02 reject ho)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

// Converts JS Date -> "10/08/2026" for sending back to frontend
export const formatToDDMMYYYY = (date) => {
  if (!date) return null;
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};