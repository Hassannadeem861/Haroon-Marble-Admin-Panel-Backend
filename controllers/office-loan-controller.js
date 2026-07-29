import officeLoan from "../models/office-loan-model.js";

const createLoan = async (req, res) => {
  try {
    const { date, employeeId, loan, reason } = req.body;

    if (!date || !employeeId || !loan) {
      return res.status(400).json({
        message: "Fields are required",
        date: "2025-09-01",
        employeeId: 10,
        loan: 11000,
      });
    }

    const newTime = await officeLoan.create({
      date,
      employeeId,
      loan,
      reason,
      created_at: new Date(),
    });

    return res
      .status(200)
      .json({ message: "Loan created successfully", newTime });
  } catch (error) {
    return res
      .status(200)
      .json({ message: "Loan created error", error: error.message });
  }
};

const getAllLoan = async (req, res) => {
  try {
    const getAllOfficeTimes = await officeLoan
      .find({
        deleted_at: null,
      })
      .populate({
        path: "employeeId",
        select: "name email empNo designation",
      })
      .sort({ created_at: -1 })
      .lean();

    if (!getAllOfficeTimes) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    return res
      .status(200)
      .json({ message: "Get all loans successfully", getAllOfficeTimes });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error in get all loans", error: error.message });
  }
};

const getSingleLoan = async (req, res) => {
  const { officeLoanId } = req.params;

  if (!officeLoanId) {
    return res.status(400).json({
      success: false,
      message: "❌officeLoanId is required in params",
    });
  }

  try {
    const getTime = await officeLoan
      .findOne({
        _id: officeLoanId,
        deleted_at: null,
      })
      .sort({ created_at: -1 })
      .lean();

    if (!getTime) {
      return res.status(404).json({
        message: "Record not found",
      });
    }

    return res
      .status(200)
      .json({ message: "Get single loan successfully", getTime });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error in get single loan", error: error.message });
  }
};

const updateLoan = async (req, res) => {
  const { officeLoanId } = req.params;

  if (!officeLoanId) {
    return res.status(400).json({
      success: false,
      message: "❌ officeLoanId is required in params",
    });
  }

  try {
    // 🔍 Step 1: Check record exists and is not already deleted
    const existingTime = await officeLoan.findOne({
      _id: officeLoanId,
      deleted_at: null,
    });

    if (!existingTime) {
      return res.status(404).json({
        success: false,
        message: "❌ Record not found or already deleted",
      });
    }

    const { date, employeeId, loan, reason } = req.body;
    const getTime = await officeLoan.findByIdAndUpdate(
      officeLoanId,
      { date, employeeId, loan, reason, updated_at: new Date() },
      { new: true }
    );

    return res
      .status(200)
      .json({ message: "Loan updated successfully", getTime });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error in update loan", error: error.message });
  }
};

const deleteLoan = async (req, res) => {
  const { officeLoanId } = req.params;

  if (!officeLoanId) {
    return res.status(400).json({
      success: false,
      message: "❌ officeLoanId is required in params",
    });
  }

  try {
    // 🔍 Step 1: Check record exists and is not already deleted
    const existingTime = await officeLoan.findOne({
      _id: officeLoanId,
      deleted_at: null,
    });

    if (!existingTime) {
      return res.status(404).json({
        success: false,
        message: "❌ Record not found or already deleted",
      });
    }

    const getTime = await officeLoan.findByIdAndUpdate(
      officeLoanId,
      { deleted_at: new Date() },
      {
        new: true,
      }
    );

    return res
      .status(200)
      .json({ message: "Loan deleted successfully", getTime });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error in delete loan", error: error.message });
  }
};

export { createLoan, getAllLoan, getSingleLoan, updateLoan, deleteLoan };
