import SiteExpense from "../models/site-expense-model.js";
import SiteMaterial from "../models/site-material-model.js";
import { formatToDDMMYYYY } from "./date-helper-fun.js";
import { round2 } from "./helperFun.js";

const buildDateFilter = (siteId, from, to) => {
  const filter = { siteId, deleted_at: null };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  return filter;
};

/**
 * buildSiteSummary(siteId, from?, to?)
 * ---------------------------------------------------------------
 * Totals for a site's expenses + material entries, optionally within a
 * date range. Used on the Site detail page.
 */
export const buildSiteSummary = async (siteId, from = null, to = null) => {
  const expenseFilter = buildDateFilter(siteId, from, to);
  const materialFilter = buildDateFilter(siteId, from, to);

  const [expenses, materials] = await Promise.all([
    SiteExpense.find(expenseFilter).lean(),
    SiteMaterial.find(materialFilter).lean(),
  ]);

  const totalExpenses = round2(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const totalMaterialValue = round2(materials.reduce((sum, m) => sum + (Number(m.estimatedValue) || 0), 0));

  const expensesByCategory = {};
  for (const e of expenses) {
    const cat = e.category || "misc";
    expensesByCategory[cat] = round2((expensesByCategory[cat] || 0) + (Number(e.amount) || 0));
  }

  return {
    expenseCount: expenses.length,
    materialCount: materials.length,
    totalExpenses,
    totalMaterialValue,
    grandTotal: round2(totalExpenses + totalMaterialValue),
    expensesByCategory,
  };
};

export const getSiteExpenses = async (siteId, { page = 1, limit = 10 } = {}) => {
  const filter = { siteId, deleted_at: null };
  const total = await SiteExpense.countDocuments(filter);
  const expenses = await SiteExpense.find(filter)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  return {
    expenses: expenses.map((e) => ({ ...e, date: formatToDDMMYYYY(e.date) })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

export const getSiteMaterials = async (siteId, { page = 1, limit = 10 } = {}) => {
  const filter = { siteId, deleted_at: null };
  const total = await SiteMaterial.countDocuments(filter);
  const materials = await SiteMaterial.find(filter)
    .sort({ date: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  return {
    materials: materials.map((m) => ({ ...m, date: formatToDDMMYYYY(m.date) })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};