
import crypto from "crypto";
 
// name -> slug + random suffix, e.g. "zahid-a1b2c3"
// ONE worker = ONE workerId, generated only at Employer creation time.
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
 
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
 
// Basic non-negative number validator used by controllers.
export const isValidNonNegativeNumber = (value) => {
  if (value === undefined || value === null || value === "") return true; // optional field, skip
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0;
};
 
export const isValidObjectIdString = (id) =>
  typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
 