import mongoose from "mongoose";
import DailyWork from "../models/daily-work-model.js";
import Employer from "../models/employer-model.js";
import { formatToDDMMYYYY, resolveEntryDate, parseDDMMYYYY } from "../utils/date-helper-fun.js";
import { isValidNonNegativeNumber, isValidObjectIdString } from "../scripts/backfillWorkerId.js";
import { calculateOvertimeAmount } from "../utils/salary-helper-fun.js";

const formatEntry = (doc) => ({
  ...doc.toObject(),
  entryDate: formatToDDMMYYYY(doc.entryDate),
});

// POST /daily-work
const createDailyWork = async (req, res) => {
  try {
    const {
      employerId,
      entryDate,
      currentSite,
      attendance,
      workStatus,
      workUnder,
      salary,
      overtimeHours = 0,
      advanceAmount = 0,
      description,
    } = req.body;

    if (!employerId || !isValidObjectIdString(employerId)) {
      return res.status(400).json({ success: false, message: "Valid employerId is required." });
    }

    const employer = await Employer.findOne({ _id: employerId, deleted_at: null });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Worker not found or has been deleted." });
    }

    if (!attendance) {
      return res.status(400).json({ success: false, message: "attendance is required." });
    }

    // Salary for the day defaults to the worker's current base rate,
    // but can be overridden per-record (e.g. a special-rate day).
    const daySalary = salary !== undefined ? salary : employer.salary;

    if (!isValidNonNegativeNumber(daySalary) || Number(daySalary) < 0) {
      return res.status(400).json({ success: false, message: "salary must be a non-negative number." });
    }
    if (!isValidNonNegativeNumber(overtimeHours)) {
      return res.status(400).json({ success: false, message: "overtimeHours must be a non-negative number." });
    }
    if (!isValidNonNegativeNumber(advanceAmount)) {
      return res.status(400).json({ success: false, message: "advanceAmount must be a non-negative number." });
    }

    let finalEntryDate;
    try {
      finalEntryDate = resolveEntryDate(entryDate, new Date());
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const overtimeAmount = calculateOvertimeAmount(daySalary, overtimeHours);

    const entry = await DailyWork.create({
      employerId,
      entryDate: finalEntryDate,
      currentSite,
      attendance,
      workStatus,
      workUnder,
      salary: daySalary,
      overtimeHours,
      overtimeAmount,
      advanceAmount,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Daily work record created successfully.",
      data: formatEntry(entry),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating daily work record.", error: error.message });
  }
};

// GET /daily-work — filters: date, startDate, endDate, employerId, site, attendance, workStatus
const getAllDailyWork = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      employerId,
      startDate,
      endDate,
      site,
      attendance,
      workStatus,
      worker, // name search, resolved to employerIds below
    } = req.query;

    const filter = { deleted_at: null };
    if (employerId && isValidObjectIdString(employerId)) filter.employerId = employerId;
    if (site) filter.currentSite = { $regex: site, $options: "i" };
    if (attendance) filter.attendance = attendance;
    if (workStatus) filter.workStatus = workStatus;

    if (startDate || endDate) {
      filter.entryDate = {};
      if (startDate) filter.entryDate.$gte = parseDDMMYYYY(startDate);
      if (endDate) filter.entryDate.$lte = parseDDMMYYYY(endDate);
    }

    if (worker) {
      const matchedEmployers = await Employer.find({
        name: { $regex: worker, $options: "i" },
        deleted_at: null,
      }).select("_id");
      filter.employerId = { $in: matchedEmployers.map((e) => e._id) };
    }

    const total = await DailyWork.countDocuments(filter);
    const entries = await DailyWork.find(filter)
      .populate("employerId", "name workerId designation")
      .sort({ entryDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: entries.map((e) => ({ ...e, entryDate: formatToDDMMYYYY(e.entryDate) })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching daily work.", error: error.message });
  }
};

// GET /daily-work/:id
const getSingleDailyWork = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await DailyWork.findOne({ _id: id, deleted_at: null }).populate(
      "employerId",
      "name workerId designation",
    );
    if (!entry) {
      return res.status(404).json({ success: false, message: "Daily work record not found." });
    }
    return res.status(200).json({ success: true, data: formatEntry(entry) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching daily work record.", error: error.message });
  }
};

// PUT /daily-work/:id
const updateDailyWork = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentSite, attendance, workStatus, workUnder, salary, overtimeHours, advanceAmount, description, entryDate } =
      req.body;

    const entry = await DailyWork.findOne({ _id: id, deleted_at: null });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Daily work record not found." });
    }

    if (salary !== undefined && !isValidNonNegativeNumber(salary)) {
      return res.status(400).json({ success: false, message: "salary must be a non-negative number." });
    }
    if (overtimeHours !== undefined && !isValidNonNegativeNumber(overtimeHours)) {
      return res.status(400).json({ success: false, message: "overtimeHours must be a non-negative number." });
    }
    if (advanceAmount !== undefined && !isValidNonNegativeNumber(advanceAmount)) {
      return res.status(400).json({ success: false, message: "advanceAmount must be a non-negative number." });
    }

    if (currentSite !== undefined) entry.currentSite = currentSite;
    if (attendance !== undefined) entry.attendance = attendance;
    if (workStatus !== undefined) entry.workStatus = workStatus;
    if (workUnder !== undefined) entry.workUnder = workUnder;
    if (salary !== undefined) entry.salary = salary;
    if (overtimeHours !== undefined) entry.overtimeHours = overtimeHours;
    if (advanceAmount !== undefined) entry.advanceAmount = advanceAmount;
    if (description !== undefined) entry.description = description;

    // Recalculate overtimeAmount whenever salary or overtimeHours changes.
    if (salary !== undefined || overtimeHours !== undefined) {
      entry.overtimeAmount = calculateOvertimeAmount(entry.salary, entry.overtimeHours);
    }

    try {
      // entryDate not sent -> keep the record's existing date (no silent "today" reset).
      entry.entryDate = resolveEntryDate(entryDate, entry.entryDate);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await entry.save();

    return res.status(200).json({
      success: true,
      message: "Daily work record updated successfully.",
      data: formatEntry(entry),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating daily work record.", error: error.message });
  }
};

// DELETE /daily-work/:id — soft delete
const deleteDailyWork = async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await DailyWork.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );
    if (!entry) {
      return res.status(404).json({ success: false, message: "Daily work record not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Daily work record deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting daily work record.", error: error.message });
  }
};

export {
  createDailyWork,
  getAllDailyWork,
  getSingleDailyWork,
  updateDailyWork,
  deleteDailyWork,
};