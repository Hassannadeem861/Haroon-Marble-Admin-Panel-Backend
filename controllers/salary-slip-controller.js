import SalarySlip from "../models/salary-slip-model.js";
import Employer from "../models/employer-model.js";

const createSalarySlip = async (req, res) => {
  try {
    const { employerId, month } = req.body;

    if (!employerId || !month) {
      return res.status(400).send(`
        ❌ Required fields are missing.
        
        👉Example request body (form-data):
           employerId: "68907690b1dbc3f4dd7d5bd4",
=           month: 2025-08

        `);
    }

    const existing = await SalarySlip.findOne({ employerId, month });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Salary slip already exists for this month." });
    }

    const newSlip = await SalarySlip.create({
      employerId,
      month,
      created_at: new Date(),
    });

    return res.status(200).json({ message: "Salary slip created", newSlip });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error creating slip", error: error.message });
  }
};

const getAllSalarySlips = async (req, res) => {
  try {
    const { employerId, month } = req.query;

    const filter = {};
    if (employerId) filter.employerId = employerId;
    if (month) filter.month = month;

    const slips = await SalarySlip.find(filter).populate(
      "employerId",
      "name email salary designation"
    );
    return res.status(200).json({ message: "Fetch all slips", slips });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching slips", error: error.message });
  }
};

const getSingleSalarySlip = async (req, res) => {
  const { salarySlipId } = req.params;
  try {
    const salarySlip = await SalarySlip.findOne({ _id: salarySlipId }).populate(
      "employerId",
      "empNo name email salary designation"
    );

    if (!salarySlip) {
      return res.status(404).json({ message: "Salary slip not found ❌" });
    }

    return res
      .status(200)
      .json({ message: "Single salary slip fetched ✅", salarySlip });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching salary slip ❌", error: error.message });
  }
};

export { createSalarySlip, getAllSalarySlips, getSingleSalarySlip };
