import SiteExpense from "../models/site-expense-model.js";
import Site from "../models/site-model.js";
import { formatToDDMMYYYY, resolveEntryDate, parseDDMMYYYY } from "../utils/date-helper-fun.js";
import { isValidNonNegativeNumber, isValidObjectIdString } from "../scripts/backfillWorkerId.js";

const formatExpense = (doc) => ({ ...doc.toObject(), date: formatToDDMMYYYY(doc.date) });

// POST /create-site-expense
const createSiteExpense = async (req, res) => {
  try {
    const { siteId, date, category, description, amount } = req.body;

    if (!siteId || !isValidObjectIdString(siteId)) {
      return res.status(400).json({ success: false, message: "Valid siteId is required." });
    }
    if (amount === undefined || !isValidNonNegativeNumber(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: "amount must be a non-negative number." });
    }

    const site = await Site.findOne({ _id: siteId, deleted_at: null });
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found or has been deleted." });
    }

    let finalDate;
    try {
      finalDate = resolveEntryDate(date, new Date());
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const expense = await SiteExpense.create({
      siteId,
      date: finalDate,
      category,
      description: description?.trim() || "",
      amount,
    });

    return res.status(201).json({ success: true, message: "Expense added successfully.", data: formatExpense(expense) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating expense.", error: error.message });
  }
};

// GET /get-all-site-expenses — filters: siteId, startDate, endDate, category
const getAllSiteExpenses = async (req, res) => {
  try {
    const { page = 1, limit = 10, siteId, startDate, endDate, category, site } = req.query;

    const filter = { deleted_at: null };
    if (siteId && isValidObjectIdString(siteId)) filter.siteId = siteId;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = parseDDMMYYYY(startDate);
      if (endDate) filter.date.$lte = parseDDMMYYYY(endDate);
    }
    if (site) {
      const matchedSites = await Site.find({ name: { $regex: site, $options: "i" }, deleted_at: null }).select("_id");
      filter.siteId = { $in: matchedSites.map((s) => s._id) };
    }

    const total = await SiteExpense.countDocuments(filter);
    const expenses = await SiteExpense.find(filter)
      .populate("siteId", "name location")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: expenses.map((e) => ({ ...e, date: formatToDDMMYYYY(e.date) })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching expenses.", error: error.message });
  }
};

// PUT /update-site-expense/:id
const updateSiteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, category, description, amount } = req.body;

    const expense = await SiteExpense.findOne({ _id: id, deleted_at: null });
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    if (amount !== undefined && !isValidNonNegativeNumber(amount)) {
      return res.status(400).json({ success: false, message: "amount must be a non-negative number." });
    }

    if (category !== undefined) expense.category = category;
    if (description !== undefined) expense.description = description;
    if (amount !== undefined) expense.amount = amount;

    try {
      expense.date = resolveEntryDate(date, expense.date);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await expense.save();

    return res.status(200).json({ success: true, message: "Expense updated successfully.", data: formatExpense(expense) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating expense.", error: error.message });
  }
};

// DELETE /delete-site-expense/:id — soft delete
const deleteSiteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await SiteExpense.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Expense deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting expense.", error: error.message });
  }
};

export { createSiteExpense, getAllSiteExpenses, updateSiteExpense, deleteSiteExpense };