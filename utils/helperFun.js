
import crypto from "crypto";

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

  // if (Number.isNaN(d.getTime())) {
  //   return null;
  // }

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};


export const calculateSalary = ({
  employerRate, // Employer.salary — treated as the per-day rate
  daysWorked,
  overtimeAmount = 0,
  advanceAmount = 0,
}) => {
  const rate = Number(employerRate) || 0;
  const days = Number(daysWorked) || 0;
  const overtime = Number(overtimeAmount) || 0;
  const advance = Number(advanceAmount) || 0;

  const salaryAmount = Math.max(rate * days, 0);
  const netAmount = Math.max(salaryAmount + overtime - advance, 0);

  return {
    salaryAmount: round2(salaryAmount),
    overtimeAmount: round2(overtime),
    advanceAmount: round2(advance),
    netAmount: round2(netAmount),
  };
};

const round2 = (n) => Math.round(n * 100) / 100;


// naam se slug + random suffix — e.g. "ali-khan-a1b2c3"
export const generateWorkerId = (name) => {
  const slug = name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
};