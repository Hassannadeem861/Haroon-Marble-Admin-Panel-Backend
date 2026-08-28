import WorkOrder from "../models/work-order-model.js";
import { formatToDDMMYYYY, resolveEntryDate } from "../utils/date-helper-fun.js";
import { getWorkOrderTimeline } from "../utils/work-order-service.js";

const formatWorkOrder = (doc) => ({
  ...doc.toObject(),
  workStartDate: formatToDDMMYYYY(doc.workStartDate),
  expectedCompletionDate: formatToDDMMYYYY(doc.expectedCompletionDate),
  actualCompletionDate: formatToDDMMYYYY(doc.actualCompletionDate),
});

// POST /create-work-order
const createWorkOrder = async (req, res) => {
  try {
    const { title, siteId, expectedCompletionDate, description } = req.body;

    if (!title || !siteId) {
      return res.status(400).json({ success: false, message: "title, siteId are required." });
    }

    let finalExpected = null;
    try {
      finalExpected = expectedCompletionDate ? resolveEntryDate(expectedCompletionDate, null) : null;
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const workOrder = await WorkOrder.create({
      title: title.trim(),
      siteId: siteId || null,
    //   expectedCompletionDate: finalExpected,
    //   description: description?.trim() || "",
    });

    return res.status(201).json({ success: true, message: "Work order created successfully.", data: formatWorkOrder(workOrder) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating work order.", error: error.message });
  }
};

// GET /get-all-work-orders
const getAllWorkOrders = async (req, res) => {
  try {
    const { search = "", status, page = 1, limit = 10 } = req.query;

    const filter = { deleted_at: null };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { siteId: await Site.find({ name: { $regex: search, $options: "i" } }).distinct("_id") },
        // { clientName: { $regex: search, $options: "i" } },
      ];
    }

    const total = await WorkOrder.countDocuments(filter);
    const workOrders = await WorkOrder.find(filter)
      .populate("siteId", "name ownerName status")
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      data: workOrders.map((w) => ({
        ...w,
        workStartDate: formatToDDMMYYYY(w.workStartDate),
        // expectedCompletionDate: formatToDDMMYYYY(w.expectedCompletionDate),
        // actualCompletionDate: formatToDDMMYYYY(w.actualCompletionDate),
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching work orders.", error: error.message });
  }
};

// GET /get-single-work-order/:workOrderId — profile + full sample-round timeline + stats
const getSingleWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;

    const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null }).populate("siteId", "name ownerName status");
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found." });
    }

    const { rounds, stats } = await getWorkOrderTimeline(workOrderId, workOrder);

    return res.status(200).json({
      success: true,
      data: {
        workOrder: formatWorkOrder(workOrder),
        rounds,
        stats,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error fetching work order.", error: error.message });
  }
};

// PUT /update-work-order/:workOrderId — profile fields + status transitions
// (workStartDate -> moves to in_progress, actualCompletionDate -> completed)
const updateWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { title, clientName, siteId, status, workStartDate, expectedCompletionDate, actualCompletionDate, description } = req.body;

    const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null });
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found." });
    }

    if (title !== undefined) workOrder.title = title.trim();
    // if (clientName !== undefined) workOrder.clientName = clientName.trim();
    if (siteId !== undefined) workOrder.siteId = siteId || null;
    if (description !== undefined) workOrder.description = description.trim();
    if (status !== undefined) workOrder.status = status;

    try {
      if (workStartDate !== undefined) {
        workOrder.workStartDate = resolveEntryDate(workStartDate, workOrder.workStartDate);
        if (workOrder.status === "approved") workOrder.status = "in_progress";
      }
    //   if (expectedCompletionDate !== undefined) {
    //     workOrder.expectedCompletionDate = resolveEntryDate(expectedCompletionDate, workOrder.expectedCompletionDate);
    //   }
      if (actualCompletionDate !== undefined) {
        workOrder.actualCompletionDate = resolveEntryDate(actualCompletionDate, workOrder.actualCompletionDate);
        if (workOrder.actualCompletionDate) workOrder.status = "completed";
      }
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    await workOrder.save();

    return res.status(200).json({ success: true, message: "Work order updated successfully.", data: formatWorkOrder(workOrder) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating work order.", error: error.message });
  }
};

// DELETE /delete-work-order/:workOrderId — soft delete
const deleteWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const workOrder = await WorkOrder.findOneAndUpdate(
      { _id: workOrderId, deleted_at: null },
      { deleted_at: new Date(), status: "cancelled" },
      { new: true },
    );
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Work order deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting work order.", error: error.message });
  }
};

export { createWorkOrder, getAllWorkOrders, getSingleWorkOrder, updateWorkOrder, deleteWorkOrder };