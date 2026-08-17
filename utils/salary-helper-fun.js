import { round2 } from "./helperFun.js";

/**
 * Overtime rate config — single source of truth.
 * Business rule: overtimeAmount = (dailySalary / 8) * overtimeHours.
 * Rate isn't a fixed global number — it's derived from that day's salary,
 * so future salary changes never need this file touched.
 */
export const HOURS_PER_DAY = 8;

// Given that day's salary + overtime hours -> overtime amount.
export const calculateOvertimeAmount = (dailySalary, overtimeHours) => {
  const salary = Number(dailySalary) || 0;
  const hours = Number(overtimeHours) || 0;
  const perHourRate = salary / HOURS_PER_DAY;
  return round2(Math.max(perHourRate * hours, 0));
};

// Single-record gross/net (used when saving one DailyWork row, not a report).
export const calculateRecordTotals = ({ salary, overtimeAmount, advanceAmount }) => {
  const s = Number(salary) || 0;
  const ot = Number(overtimeAmount) || 0;
  const adv = Number(advanceAmount) || 0;

  const grossSalary = round2(s + ot);
  const netSalary = round2(Math.max(grossSalary - adv, 0));

  return { grossSalary, netSalary };
};