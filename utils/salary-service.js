import DailyWork from "../models/daily-work-model.js";
import { formatToDDMMYYYY } from "./date-helper-fun.js";
import { round2 } from "./helperFun.js";

/**
 * Build the base Mongo filter for a worker's DailyWork entries,
 * optionally bounded by an entryDate range.
 */
const buildDateFilter = (employerId, from, to) => {
  const filter = { employerId, deleted_at: null };
  if (from || to) {
    filter.entryDate = {};
    if (from) filter.entryDate.$gte = from;
    if (to) filter.entryDate.$lte = to;
  }
  return filter;
};

/**
 * buildSalarySlip(employerId, from?, to?)
 * ---------------------------------------------------------------
 * Aggregates a worker's DailyWork history (optionally within a date
 * range) into a payroll summary. Used two ways in employer-controller.js:
 *   - buildSalarySlip(employerId)              -> quick summary for the
 *                                                  worker's detail page
 *   - buildSalarySlip(employerId, from, to)     -> a proper period slip
 *
 * NOTE: absent days are recorded (attendance history) but do not add to
 * totalBaseSalary — only "present" days are paid. Adjust here if your
 * business rule pays a partial/different rate for absent days.
 */
export const buildSalarySlip = async (employerId, from = null, to = null) => {
  const filter = buildDateFilter(employerId, from, to);
  const entries = await DailyWork.find(filter).sort({ entryDate: 1 }).lean();

  const totalDays = entries.length;
  const presentDays = entries.filter((e) => e.attendance === "present").length;
  const absentDays = totalDays - presentDays;

  let totalBaseSalary = 0;
  let totalOvertimeHours = 0;
  let totalOvertimeAmount = 0;
  let totalAdvance = 0;

  for (const entry of entries) {
    if (entry.attendance === "present") {
      totalBaseSalary += Number(entry.salary) || 0;
    }
    totalOvertimeHours += Number(entry.overtimeHours) || 0;
    totalOvertimeAmount += Number(entry.overtimeAmount) || 0;
    totalAdvance += Number(entry.advanceAmount) || 0;
  }

  const grossSalary = round2(totalBaseSalary + totalOvertimeAmount);
  const netSalary = round2(Math.max(grossSalary - totalAdvance, 0));

  return {
    totalDays,
    presentDays,
    absentDays,
    totalBaseSalary: round2(totalBaseSalary),
    totalOvertimeHours: round2(totalOvertimeHours),
    totalOvertimeAmount: round2(totalOvertimeAmount),
    totalAdvance: round2(totalAdvance),
    grossSalary,
    netSalary,
  };
};

/**
 * getRecentEntries(employerId, { page, limit })
 * ---------------------------------------------------------------
 * Paginated DailyWork history for a worker, newest first — used on the
 * worker detail page. Mirrors the same pagination shape as
 * getAllDailyWork in daily-work-controller.js.
 */
/**
 * getSalarySlipEntries(employerId, from?, to?)
 * ---------------------------------------------------------------
 * Full (non-paginated) itemized DailyWork list for a period, oldest
 * first — used to render the row-by-row salary slip table alongside
 * buildSalarySlip's totals.
 */
export const getSalarySlipEntries = async (employerId, from = null, to = null) => {
  const filter = buildDateFilter(employerId, from, to);
  const entries = await DailyWork.find(filter).sort({ entryDate: 1 }).lean();
  return entries.map((e) => ({ ...e, entryDate: formatToDDMMYYYY(e.entryDate) }));
};

export const getRecentEntries = async (employerId, { page = 1, limit = 10 } = {}) => {
  const filter = { employerId, deleted_at: null };

  const total = await DailyWork.countDocuments(filter);
  const entries = await DailyWork.find(filter)
    .sort({ entryDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  return {
    entries: entries.map((e) => ({ ...e, entryDate: formatToDDMMYYYY(e.entryDate) })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};