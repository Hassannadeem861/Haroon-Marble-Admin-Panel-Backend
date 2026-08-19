import Site from "../models/site-model.js";
import SiteExpense from "../models/site-expense-model.js";
import SiteMaterial from "../models/site-material-model.js";
import Employer from "../models/employer-model.js";
import DailyWork from "../models/daily-work-model.js"; 
import FactoryWork from "../models/factory-work-model.js"; 

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

// GET /dashboard-summary
const getDashboardSummary = async (req, res) => {
  try {
    const monthStart = startOfMonth();

    const [
      activeWorkers,
      activeSites,
      monthSiteExpenseAgg,
      monthMaterialAgg,
      monthPayrollAgg,
      advanceOutstandingAgg,
      recentExpenses,
      recentMaterials,
      recentDailyWork,
      monthlyPayrollTrend,
      siteExpenseBreakdown,
      attendanceOverview,
    ] = await Promise.all([
      // ── stat cards ──
      Employer.countDocuments({ status: "active", deleted_at: null }),
      Site.countDocuments({ status: "active", deleted_at: null }),

      SiteExpense.aggregate([
        { $match: { deleted_at: null, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      SiteMaterial.aggregate([
        { $match: { deleted_at: null, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$estimatedValue" } } },
      ]),

      // Assumes DailyWork has: entryDate, salary, overtimeAmount, advanceAmount
      DailyWork.aggregate([
        { $match: { deleted_at: null, entryDate: { $gte: monthStart } } },
        {
          $group: {
            _id: null,
            salary: { $sum: "$salary" },
            overtime: { $sum: "$overtimeAmount" },
            advance: { $sum: "$advanceAmount" },
          },
        },
      ]),

      // Total advance ever given minus... (placeholder: sum of all advanceAmount, all-time)
      DailyWork.aggregate([
        { $match: { deleted_at: null } },
        { $group: { _id: null, total: { $sum: "$advanceAmount" } } },
      ]),

      // ── recent activity ──
      SiteExpense.find({ deleted_at: null })
        .populate("siteId", "name")
        .sort({ created_at: -1 })
        .limit(5)
        .lean(),

      SiteMaterial.find({ deleted_at: null })
        .populate("siteId", "name")
        .sort({ created_at: -1 })
        .limit(5)
        .lean(),

      DailyWork.find({ deleted_at: null })
        .populate("employerId", "name")
        .sort({ created_at: -1 })
        .limit(5)
        .lean(),

      // ── monthly payroll trend, last 6 months ──
      DailyWork.aggregate([
        { $match: { deleted_at: null } },
        {
          $group: {
            _id: { y: { $year: "$entryDate" }, m: { $month: "$entryDate" } },
            total: { $sum: { $add: ["$salary", "$overtimeAmount"] } },
          },
        },
        { $sort: { "_id.y": -1, "_id.m": -1 } },
        { $limit: 6 },
      ]),

      // ── site-wise expense breakdown, this month ──
      SiteExpense.aggregate([
        { $match: { deleted_at: null, date: { $gte: monthStart } } },
        { $group: { _id: "$siteId", total: { $sum: "$amount" } } },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "_id",
            as: "site",
          },
        },
        { $unwind: "$site" },
        { $project: { siteName: "$site.name", total: 1 } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),

      // ── attendance overview, this month ──
      DailyWork.aggregate([
        { $match: { deleted_at: null, entryDate: { $gte: monthStart } } },
        { $group: { _id: "$attendance", count: { $sum: 1 } } },
      ]),
    ]);

    const monthlyPayroll = monthPayrollAgg[0]
      ? monthPayrollAgg[0].salary + monthPayrollAgg[0].overtime - monthPayrollAgg[0].advance
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        statCards: {
          activeWorkers,
          activeSites,
          monthlyPayroll,
          monthlySiteCost: (monthSiteExpenseAgg[0]?.total || 0) + (monthMaterialAgg[0]?.total || 0),
          advanceOutstanding: advanceOutstandingAgg[0]?.total || 0,
        },
        recentActivity: {
          expenses: recentExpenses,
          materials: recentMaterials,
          dailyWork: recentDailyWork,
        },
        charts: {
          monthlyPayrollTrend: monthlyPayrollTrend.reverse(),
          siteExpenseBreakdown,
          attendanceOverview,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error building dashboard.", error: error.message });
  }
};

export { getDashboardSummary };