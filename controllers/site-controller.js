import Site from "../models/site-model.js";
import { formatToDDMMYYYY, resolveEntryDate } from "../utils/date-helper-fun.js";
import { isValidNonNegativeNumber } from "../scripts/backfillWorkerId.js";
import { buildSiteSummary, getSiteExpenses, getSiteMaterials } from "../utils/site-service.js";

const formatSite = (doc) => ({
  ...doc.toObject(),
  startDate: formatToDDMMYYYY(doc.startDate),
});

// POST /create-site
const createSite = async (req, res) => {
  try {
    const { name, location, ownerName, startDate, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Required field missing: name" });
    }

    let finalStartDate;
    try {
      finalStartDate = resolveEntryDate(startDate, new Date());
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const site = await Site.create({
      name: name.trim(),
      location: location?.trim() || "",
      ownerName: ownerName?.trim() || "",
      startDate: finalStartDate,
      description: description?.trim() || "",
    });

    return res.status(201).json({ success: true, message: "Site created successfully.", data: formatSite(site) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating site.", error: error.message });
  }
};

// GET /get-all-sites — list, search, paginate
const getAllSites = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 10 } = req.query;

    const filter = { deleted_at: null };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { ownerName: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Site.countDocuments(filter);
    const sites = await Site.find(filter)
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: sites.map((s) => ({ ...s, startDate: formatToDDMMYYYY(s.startDate) })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching sites.", error: error.message });
  }
};

// GET /get-single-site/:siteId — profile + expenses + materials + summary
const getSingleSite = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const site = await Site.findOne({ _id: siteId, deleted_at: null });
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found." });
    }

    const [summary, expensesResult, materialsResult] = await Promise.all([
      buildSiteSummary(siteId),
      getSiteExpenses(siteId, { page, limit }),
      getSiteMaterials(siteId, { page, limit }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        site: formatSite(site),
        summary,
        expenses: expensesResult.expenses,
        expensesPagination: expensesResult.pagination,
        materials: materialsResult.materials,
        materialsPagination: materialsResult.pagination,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching site.", error: error.message });
  }
};

// PUT /update-site/:siteId
const updateSite = async (req, res) => {
  try {
    const { siteId } = req.params;
    const { name, location, ownerName, startDate, status, description } = req.body;

    const site = await Site.findOne({ _id: siteId, deleted_at: null });
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found." });
    }

    if (name !== undefined) site.name = name.trim();
    if (location !== undefined) site.location = location.trim();
    if (ownerName !== undefined) site.ownerName = ownerName.trim();
    if (status !== undefined) site.status = status;
    if (description !== undefined) site.description = description.trim();

    try {
      site.startDate = resolveEntryDate(startDate, site.startDate);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await site.save();

    return res.status(200).json({ success: true, message: "Site updated successfully.", data: formatSite(site) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating site.", error: error.message });
  }
};

// DELETE /delete-site/:siteId — soft delete
const deleteSite = async (req, res) => {
  try {
    const { siteId } = req.params;
    const site = await Site.findOneAndUpdate(
      { _id: siteId, deleted_at: null },
      { deleted_at: new Date(), status: "completed" },
      { new: true },
    );
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Site deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting site.", error: error.message });
  }
};

// GET /sites-list — active sites for dropdowns (expense/material forms)
const getSitesList = async (req, res) => {
  try {
    const sites = await Site.find({ deleted_at: null, status: "active" })
      .select("name location ownerName")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ success: true, data: sites });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch sites list.", error: error.message });
  }
};

export { createSite, getAllSites, getSingleSite, updateSite, deleteSite, getSitesList };