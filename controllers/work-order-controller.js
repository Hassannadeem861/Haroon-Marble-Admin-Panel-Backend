import WorkOrder from "../models/work-order-model.js";
import Site from "../models/site-model.js";
import { formatToDDMMYYYY } from "../utils/date-helper-fun.js";
import { isValidObjectIdString } from "../utils/validators.js";
import { getWorkOrderTimeline, syncWorkOrderStatus } from "../utils/work-order-service.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatWorkOrder = (doc) => ({
  ...doc.toObject(),
  workStartDate: formatToDDMMYYYY(doc.workStartDate),
  actualCompletionDate: formatToDDMMYYYY(doc.actualCompletionDate),
});

// POST /create-work-order
const createWorkOrder = async (req, res) => {
  try {
    const { title, siteId, clientName, description } = req.body;

    if (!title?.trim() || !siteId) {
      return res.status(400).json({ success: false, message: "title, siteId are required." });
    }
    if (!isValidObjectIdString(siteId)) {
      return res.status(400).json({ success: false, message: "Valid siteId is required." });
    }

    const site = await Site.findOne({ _id: siteId, deleted_at: null });
    if (!site) {
      return res.status(404).json({ success: false, message: "Site not found or has been deleted." });
    }

    const workOrder = await WorkOrder.create({
      title: title.trim(),
      siteId,
      // Client ka naam na diya ho to site ke owner ka naam.
      clientName: clientName?.trim() || site.ownerName || "",
      description: description?.trim() || "",
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
      const pattern = escapeRegex(String(search));
      const matchedSiteIds = await Site.find({ name: { $regex: pattern, $options: "i" } }).distinct("_id");
      filter.$or = [
        { title: { $regex: pattern, $options: "i" } },
        { clientName: { $regex: pattern, $options: "i" } },
        { siteId: { $in: matchedSiteIds } },
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

// PUT /update-work-order/:workOrderId — profile fields only.
// Status rounds se khud sync hota hai; manually sirf "cancelled" set (ya wapas khol) sakte hain.
const updateWorkOrder = async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { title, clientName, siteId, status, description } = req.body;

    if (!isValidObjectIdString(workOrderId)) {
      return res.status(400).json({ success: false, message: "Invalid work order id." });
    }

    const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null });
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found." });
    }

    if (status !== undefined && status !== workOrder.status && status !== "cancelled" && workOrder.status !== "cancelled") {
      return res.status(400).json({ success: false, message: "Status khud update hota hai — manually sirf Cancel kar sakte hain." });
    }

    if (siteId !== undefined) {
      if (!isValidObjectIdString(siteId)) {
        return res.status(400).json({ success: false, message: "Valid siteId is required." });
      }
      const site = await Site.findOne({ _id: siteId, deleted_at: null });
      if (!site) {
        return res.status(404).json({ success: false, message: "Site not found or has been deleted." });
      }
      workOrder.siteId = siteId;
    }

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ success: false, message: "Title khali nahi ho sakta." });
      workOrder.title = title.trim();
    }
    if (clientName !== undefined) workOrder.clientName = clientName.trim();
    if (description !== undefined) workOrder.description = description.trim();

    const reopening = workOrder.status === "cancelled" && status !== undefined && status !== "cancelled";
    if (status === "cancelled") workOrder.status = "cancelled";
    if (reopening) workOrder.status = "pending_sample";

    await workOrder.save();

    // Cancel se wapas kholne par asal status rounds se dobara nikalo.
    const finalWorkOrder = reopening ? await syncWorkOrderStatus(workOrder._id) : workOrder;

    return res.status(200).json({ success: true, message: "Work order updated successfully.", data: formatWorkOrder(finalWorkOrder) });
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