import SampleRound from "../models/sample-round-model.js";
import WorkOrder from "../models/work-order-model.js";
import { formatToDDMMYYYY, resolveEntryDate } from "../utils/date-helper-fun.js";
import { isValidObjectIdString } from "../scripts/backfillWorkerId.js";

const formatRound = (doc) => ({
  ...doc.toObject(),
  sampleStartDate: formatToDDMMYYYY(doc.sampleStartDate),
  sampleReadyDate: formatToDDMMYYYY(doc.sampleReadyDate),
  sentToClientDate: formatToDDMMYYYY(doc.sentToClientDate),
  clientResponseDate: formatToDDMMYYYY(doc.clientResponseDate),
});

// POST /create-sample-round — auto-increments roundNumber for the work order.
// Use this both for the very first sample AND for a redesign after rejection.
const createSampleRound = async (req, res) => {
  try {
    const { workOrderId, workStartDate, sampleStartDate, sampleReadyDate, sentToClientDate, description } = req.body;

    if (!workOrderId || !isValidObjectIdString(workOrderId)) {
      return res.status(400).json({ success: false, message: "Valid workOrderId is required." });
    }

    const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null });
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found or has been deleted." });
    }

    const existingCount = await SampleRound.countDocuments({ workOrderId, deleted_at: null });
    const roundNumber = existingCount + 1;

    let finalReadyDate = null;
    let finalSentDate = null;
    let finalSampleStartDate = null;
    try {
      finalSampleStartDate = (sampleStartDate || workStartDate)
        ? resolveEntryDate(sampleStartDate || workStartDate, null)
        : null;
      finalReadyDate = sampleReadyDate ? resolveEntryDate(sampleReadyDate, null) : null;
      finalSentDate = sentToClientDate ? resolveEntryDate(sentToClientDate, null) : null;
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    const round = await SampleRound.create({
      workOrderId,
      roundNumber,
      sampleStartDate: finalSampleStartDate,
      sampleReadyDate: finalReadyDate,
      sentToClientDate: finalSentDate,
      description: description?.trim() || "",
    });

    // First round moves the work order out of its default state so it
    // shows as "waiting on client" rather than "not started".
    if (workOrder.status === "pending_sample") {
      workOrder.status = "in_review";
      await workOrder.save();
    }

    return res.status(201).json({ success: true, message: "Sample round added successfully.", data: formatRound(round) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error creating sample round.", error: error.message });
  }
};

// PUT /update-sample-round/:id — record client's response (approved/rejected).
// Approving syncs the parent WorkOrder.status to "approved" automatically.
const updateSampleRound = async (req, res) => {
  try {
    const { id } = req.params;
    const { workStartDate, sampleStartDate, sampleReadyDate, sentToClientDate, clientResponseDate, responseStatus, rejectionNotes } = req.body;

    const round = await SampleRound.findOne({ _id: id, deleted_at: null });
    if (!round) {
      return res.status(404).json({ success: false, message: "Sample round not found." });
    }

    try {
      if (sampleStartDate !== undefined || workStartDate !== undefined) {
        round.sampleStartDate = resolveEntryDate(sampleStartDate || workStartDate, round.sampleStartDate);
      }
      if (sampleReadyDate !== undefined) round.sampleReadyDate = resolveEntryDate(sampleReadyDate, round.sampleReadyDate);
      if (sentToClientDate !== undefined) round.sentToClientDate = resolveEntryDate(sentToClientDate, round.sentToClientDate);
      if (clientResponseDate !== undefined) round.clientResponseDate = resolveEntryDate(clientResponseDate, round.clientResponseDate);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }

    if (responseStatus !== undefined) round.responseStatus = responseStatus;
    if (rejectionNotes !== undefined) round.rejectionNotes = rejectionNotes.trim();

    await round.save();

    // Keep the parent WorkOrder's status in sync with the latest response.
    if (responseStatus === "approved") {
      await WorkOrder.findByIdAndUpdate(round.workOrderId, { status: "approved" });
    } else if (responseStatus === "rejected") {
      await WorkOrder.findByIdAndUpdate(round.workOrderId, { status: "in_review" });
    }

    return res.status(200).json({ success: true, message: "Sample round updated successfully.", data: formatRound(round) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error updating sample round.", error: error.message });
  }
};

// DELETE /delete-sample-round/:id — soft delete (rare — mistaken entry only)
const deleteSampleRound = async (req, res) => {
  try {
    const { id } = req.params;
    const round = await SampleRound.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { deleted_at: new Date() },
      { new: true },
    );
    if (!round) {
      return res.status(404).json({ success: false, message: "Sample round not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Sample round deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Error deleting sample round.", error: error.message });
  }
};

export { createSampleRound, updateSampleRound, deleteSampleRound };