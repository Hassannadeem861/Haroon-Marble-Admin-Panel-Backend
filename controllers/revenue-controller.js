import Revenue from "../models/revenue-model.js";

const createRevenue = async (req, res) => {
  try {
    const { date, reason, amount, type } = req.body;

    if (!date || !reason || !amount || !type) {
      return res.status(400).send(`
        ❌ Required fields are missing.

        👉 Required:
        date
        reason
        amount
        type
      `);
    }

    const newRevenue = await Revenue.create({
      date,
      reason,
      amount,
      type,
      created_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "✅ Revenue created successfully",
      newRevenue,
    });
  } catch (error) {
    return res.status(500).json({
      message: "❌ Error creating revenue",
      error: error.message,
    });
  }
};

const getAllRevenues = async (req, res) => {
  try {
    const revenues = await Revenue.find({ deleted_at: null });
      if (!revenues) {
      return res.status(404).json({
        message: "✅ Revenues not found",
      });
    }
    return res.status(200).json({
      message: "✅ All Revenues fetched",
      revenues,
    });
  } catch (error) {
    return res.status(500).json({
      message: "❌ Error fetching revenues",
      error: error.message,
    });
  }
};

const getSingleRevenue = async (req, res) => {
  const { revenueId } = req.params;
  try {
    const revenue = await Revenue.findOne({
      _id: revenueId,
      deleted_at: null,
    });

    if (!revenue) {
      return res.status(404).json({ message: "❌ Revenue not found" });
    }

    return res.status(200).json({
      message: "✅ Single revenue fetched",
      revenue,
    });
  } catch (error) {
    return res.status(500).json({
      message: "❌ Error fetching revenue",
      error: error.message,
    });
  }
};

const updateRevenue = async (req, res) => {
  const { revenueId } = req.params;
  try {
    const { date, reason, amount, type } = req.body;

    const updatedFields = {
      date,
      reason,
      amount,
      type,
      updated_at: new Date(),
    };

    const updatedRevenue = await Revenue.findOneAndUpdate(
      { _id: revenueId, deleted_at: null },
      updatedFields,
      { new: true }
    );

    if (!updatedRevenue) {
      return res.status(404).json({
        message: "❌ Revenue not found or already deleted",
      });
    }

    return res.status(200).json({
      success: true,
      message: "✅ Revenue updated successfully",
      updatedRevenue,
    });
  } catch (error) {
    return res.status(500).json({
      message: "❌ Error updating revenue",
      error: error.message,
    });
  }
};

const deleteRevenue = async (req, res) => {
  const { revenueId } = req.params;
  try {
    const deletedRevenue = await Revenue.findOneAndUpdate(
      { _id: revenueId, deleted_at: null },
      { deleted_at: new Date() },
      { new: true }
    );

    if (!deletedRevenue) {
      return res.status(404).json({
        message: "❌ Revenue not found or already deleted",
      });
    }

    return res.status(200).json({
      message: "✅ Revenue deleted successfully (soft delete)",
    });
  } catch (error) {
    return res.status(500).json({
      message: "❌ Error deleting revenue",
      error: error.message,
    });
  }
};

export {
  createRevenue,
  getAllRevenues,
  getSingleRevenue,
  updateRevenue,
  deleteRevenue,
};
