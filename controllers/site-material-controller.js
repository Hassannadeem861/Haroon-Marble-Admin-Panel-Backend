import SiteMaterial from "../models/site-material-model.js";
import Site from "../models/site-model.js";
import { formatToDDMMYYYY, resolveEntryDate, parseDDMMYYYY } from "../utils/date-helper-fun.js";
import { isValidNonNegativeNumber, isValidObjectIdString } from "../scripts/backfillWorkerId.js";

const formatMaterial = (doc) => ({ ...doc.toObject(), date: formatToDDMMYYYY(doc.date) });

// POST /create-site-material
const createSiteMaterial = async (req, res) => {
  try {
    const { siteId, date, materialName, quantity, unit, estimatedValue, broughtBy, notes } = req.body;

    if (!siteId || !isValidObjectIdString(siteId)) {
      return res.status(400).json({ success: false, message: "Valid siteId is required." });
    }
    if (!materialName) {
      return res.status(400).json({ success: false, message: "materialName is required." });
    }
    if (quantity === undefined || !isValidNonNegativeNumber(quantity) || Number(quantity) < 0) {
      return res.status(400).json({ success: false, message: "quantity must be a non-negative number." });
    }
    if (estimatedValue !== undefined && !isValidNonNegativeNumber(estimatedValue)) {
      return res.status(400).json({ success: false, message: "estimatedValue must be a non-negative number." });
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

    const material = await SiteMaterial.create({
      siteId,
      date: finalDate,
      materialName: materialName.trim(),
      quantity,
      unit: unit?.trim() || "",
      estimatedValue: estimatedValue || 0,
      broughtBy: broughtBy || "owner",
      notes: notes?.trim() || "",
    });

    return res.status(201).json({ success: true, message: "Material entry added successfully.", data: formatMaterial(material) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating material entry.", error: error.message });
  }
};

// GET /get-all-site-materials — filters: siteId, startDate, endDate
const getAllSiteMaterials = async (req, res) => {
  try {
    const { page = 1, limit = 10, siteId, startDate, endDate, site } = req.query;

    const filter = { deleted_at: null };
    if (siteId && isValidObjectIdString(siteId)) filter.siteId = siteId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = parseDDMMYYYY(startDate);
      if (endDate) filter.date.$lte = parseDDMMYYYY(endDate);
    }
    if (site) {
      const matchedSites = await Site.find({ name: { $regex: site, $options: "i" }, deleted_at: null }).select("_id");
      filter.siteId = { $in: matchedSites.map((s) => s._id) };
    }

    const total = await SiteMaterial.countDocuments(filter);
    const materials = await SiteMaterial.find(filter)
      .populate("siteId", "name location")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: materials.map((m) => ({ ...m, date: formatToDDMMYYYY(m.date) })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching material entries.", error: error.message });
  }
};

// PUT /update-site-material/:id
const updateSiteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, materialName, quantity, unit, estimatedValue, broughtBy, notes } = req.body;

    const material = await SiteMaterial.findOne({ _id: id, deleted_at: null });
    if (!material) {
      return res.status(404).json({ success: false, message: "Material entry not found." });
    }

    if (quantity !== undefined && !isValidNonNegativeNumber(quantity)) {
      return res.status(400).json({ success: false, message: "quantity must be a non-negative number." });
    }
    if (estimatedValue !== undefined && !isValidNonNegativeNumber(estimatedValue)) {
      return res.status(400).json({ success: false, message: "estimatedValue must be a non-negative number." });
    }

    if (materialName !== undefined) material.materialName = materialName.trim();
    if (quantity !== undefined) material.quantity = quantity;
    if (unit !== undefined) material.unit = unit;
    if (estimatedValue !== undefined) material.estimatedValue = estimatedValue;
    if (broughtBy !== undefined) material.broughtBy = broughtBy;
    if (notes !== undefined) material.notes = notes;

    try {
      material.date = resolveEntryDate(date, material.date);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await material.save();

    return res.status(200).json({ success: true, message: "Material entry updated successfully.", data: formatMaterial(material) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating material entry.", error: error.message });
  }
};

// DELETE /delete-site-material/:id — soft delete
const deleteSiteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const material = await SiteMaterial.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );
    if (!material) {
      return res.status(404).json({ success: false, message: "Material entry not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Material entry deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting material entry.", error: error.message });
  }
};

export { createSiteMaterial, getAllSiteMaterials, updateSiteMaterial, deleteSiteMaterial };