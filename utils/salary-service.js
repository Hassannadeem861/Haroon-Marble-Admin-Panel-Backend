import mongoose from "mongoose";
import DailyWork from "../models/daily-work-model.js";
import { round2 } from "../utils/helperFun.js";

/**
 * Build a salary slip for one employer over a date range, computed from
 * DailyWork records via MongoDB aggregation (no bulk load into Node memory).
 */
export const buildSalarySlip = async (employerId, fromDate, toDate) => {
  const match = {
    employerId: new mongoose.Types.ObjectId(employerId),
    deleted_at: null,
  };

  if (fromDate || toDate) {
    match.entryDate = {};
    if (fromDate) match.entryDate.$gte = fromDate;
    if (toDate) match.entryDate.$lte = toDate;
  }

  const [summary] = await DailyWork.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        presentDays: { $sum: { $cond: [{ $eq: ["$attendance", "present"] }, 1, 0] } },
        absentDays: { $sum: { $cond: [{ $eq: ["$attendance", "absent"] }, 1, 0] } },
        totalSalary: {
          $sum: { $cond: [{ $eq: ["$attendance", "present"] }, "$salary", 0] },
        },
        totalOvertimeHours: { $sum: "$overtimeHours" },
        overtimeAmount: { $sum: "$overtimeAmount" },
        totalAdvance: { $sum: "$advanceAmount" },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const base = summary || {
    presentDays: 0,
    absentDays: 0,
    totalSalary: 0,
    totalOvertimeHours: 0,
    overtimeAmount: 0,
    totalAdvance: 0,
  };

  const grossAmount = round2(base.totalSalary + base.overtimeAmount);
  const netAmount = round2(Math.max(grossAmount - base.totalAdvance, 0));

  return {
    presentDays: base.presentDays,
    absentDays: base.absentDays,
    totalSalary: round2(base.totalSalary),
    totalOvertimeHours: base.totalOvertimeHours,
    overtimeAmount: round2(base.overtimeAmount),
    totalAdvance: round2(base.totalAdvance),
    grossAmount,
    netAmount,
  };
};

/**
 * Paginated recent DailyWork entries for a worker (used on worker detail page).
 */
export const getRecentEntries = async (employerId, { page = 1, limit = 10 } = {}) => {
  const filter = { employerId, deleted_at: null };
  const total = await DailyWork.countDocuments(filter);
  const entries = await DailyWork.find(filter)
    .sort({ entryDate: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  return {
    entries,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};