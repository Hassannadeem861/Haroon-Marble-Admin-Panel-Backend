import Employer from "../models/employer-model.js";
import { formatToDDMMYYYY, resolveEntryDate, parseDDMMYYYY } from "../utils/date-helper-fun.js";
import {
  generateWorkerId,
  isValidNonNegativeNumber,
} from "../scripts/backfillWorkerId.js";
import { buildSalarySlip, getRecentEntries } from "../utils/salary-service.js";

const formatEmployer = (doc) => ({
  ...doc.toObject(),
  entryDate: formatToDDMMYYYY(doc.entryDate),
});

// POST /employers — create a NEW worker master profile (once per worker).
const createEmployer = async (req, res) => {
  try {
    const { name, designation, salary, workUnder, entryDate, description } = req.body;

    const missingFields = ["name", "designation", "salary"].filter(
      (key) => req.body[key] === undefined || req.body[key] === null || req.body[key] === "",
    );
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Required fields missing: ${missingFields.join(", ")}`,
      });
    }

    if (!isValidNonNegativeNumber(salary) || Number(salary) <= 0) {
      return res.status(400).json({ success: false, message: "Salary must be a positive number." });
    }

    let finalEntryDate;
    try {
      finalEntryDate = resolveEntryDate(entryDate, new Date());
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const employer = await Employer.create({
      name: name.trim(),
      workerId: generateWorkerId(name),
      designation,
      workUnder,
      salary,
      entryDate: finalEntryDate,
      description: description?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Worker created successfully.",
      data: formatEmployer(employer),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating worker.", error: error.message });
  }
};

// GET /employers — list, search, paginate
const getAllEmployers = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const filter = { deleted_at: null };
    // if (status) filter.status = status;
    // console.log("status: ",status)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { workerId: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
        { workUnder: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Employer.countDocuments(filter);
    const employers = await Employer.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: employers.map((e) => ({ ...e, entryDate: formatToDDMMYYYY(e.entryDate) })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching workers.", error: error.message });
  }
};

// GET /employers/:employerId — worker profile + daily history + summaries
const getSingleEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const employer = await Employer.findOne({ _id: employerId, deleted_at: null });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Worker not found." });
    }

    const { entries, pagination } = await getRecentEntries(employerId, { page, limit });
    const summary = await buildSalarySlip(employerId);

    return res.status(200).json({
      success: true,
      data: {
        employer: formatEmployer(employer),
        summary,
        recentWork: entries,
        pagination,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching worker.", error: error.message });
  }
};

// PUT /employers/:employerId — update master profile only
const updateEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;
    const { name, description, salary, designation, workUnder, status, entryDate } = req.body;

    const employer = await Employer.findOne({ _id: employerId, deleted_at: null });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Worker not found." });
    }

    if (salary !== undefined && (!isValidNonNegativeNumber(salary) || Number(salary) <= 0)) {
      return res.status(400).json({ success: false, message: "Salary must be a positive number." });
    }

    if (name !== undefined) employer.name = name.trim();
    if (description !== undefined) employer.description = description.trim();
    if (salary !== undefined) employer.salary = salary;
    if (designation !== undefined) employer.designation = designation;
    if (workUnder !== undefined) employer.workUnder = workUnder;
    if (status !== undefined) employer.status = status;

    try {
      // Agar entryDate nahi bheji, to existing value hi rahegi (aaj ki date nahi lagegi).
      employer.entryDate = resolveEntryDate(entryDate, employer.entryDate);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await employer.save();

    return res.status(200).json({
      success: true,
      message: "Worker updated successfully.",
      data: formatEmployer(employer),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating worker.", error: error.message });
  }
};

// DELETE /employers/:employerId — soft delete only
const deleteEmployer = async (req, res) => {
  try {
    const { employerId } = req.params;
    const employer = await Employer.findOneAndUpdate(
      { _id: employerId, deleted_at: null },
      { deleted_at: new Date(), status: "inactive" },
      { new: true },
    );
    if (!employer) {
      return res.status(404).json({ success: false, message: "Worker not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Worker deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting worker.", error: error.message });
  }
};

// GET /employers/workers-list — active workers for the DailyWork form dropdown
const getWorkersList = async (req, res) => {
  try {
    const workers = await Employer.find({ deleted_at: null})
      .select("workerId name designation salary")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ success: true, data: workers });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch workers list.", error: error.message });
  }
};

// GET /employers/:employerId/salary-slip?startDate=&endDate=
const getEmployerSalarySlip = async (req, res) => {
  try {
    const { employerId } = req.params;
    const { startDate, endDate } = req.query;

    const employer = await Employer.findOne({ _id: employerId, deleted_at: null });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Worker not found." });
    }

    const from = startDate ? parseDDMMYYYY(startDate) : null;
    const to = endDate ? parseDDMMYYYY(endDate) : null;

    if ((startDate && !from) || (endDate && !to)) {
      return res.status(400).json({ success: false, message: "Invalid startDate/endDate. Use DD/MM/YYYY." });
    }

    const slip = await buildSalarySlip(employerId, from, to);

    return res.status(200).json({
      success: true,
      slip: {
        employer: { id: employer._id, name: employer.name, designation: employer.designation },
        period: { startDate: startDate || null, endDate: endDate || null },
        ...slip,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to generate salary slip.", error: error.message });
  }
};

export {
  createEmployer,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
  getWorkersList,
  getEmployerSalarySlip,
};