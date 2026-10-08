import WorkDay from "../models/work-day-model.js";
import SampleRound from "../models/sample-round-model.js";
import WorkOrder from "../models/work-order-model.js";
import { formatToDDMMYYYY, parseDDMMYYYY, resolveEntryDate } from "../utils/date-helper-fun.js";
import { isValidObjectIdString, isMongooseInputError } from "../utils/validators.js";
import { formatWorkDay, pakistanDayIndex } from "../utils/work-order-service.js";

// Din hamesha 00:00 PKT par store ho (date na di ho to aaj) — taake ek din = ek hi value.
const resolveDay = (dateStr, fallback) => parseDDMMYYYY(formatToDDMMYYYY(resolveEntryDate(dateStr, fallback)));

const badRequest = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const sendError = (res, error, fallbackMessage) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (isMongooseInputError(error)) return res.status(400).json({ success: false, message: error.message });
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

// Din ki date: future nahi, kaam shuru se pehle nahi, kaam mukammal ke baad nahi,
// shuru wala din dobara nahi, aur ek round mein ek date ek hi dafa.
// Round ki dates mein waqt bhi ho sakta hai, is liye muqabla Pakistan ke din se.
const validateWorkDayDate = async (round, date, excludeId = null) => {
  const day = pakistanDayIndex(date);
  if (day > pakistanDayIndex(new Date())) throw badRequest("Aane wali (future) date nahi di ja sakti.");
  if (round.sampleStartDate) {
    const startDay = pakistanDayIndex(round.sampleStartDate);
    if (day < startDay) throw badRequest("Ye date kaam shuru hone se pehle ki hai.");
    if (day === startDay) throw badRequest("Ye kaam shuru ka din hai — ye pehle se record hai.");
  }
  if (round.sampleReadyDate && day > pakistanDayIndex(round.sampleReadyDate)) {
    throw badRequest("Ye date kaam mukammal hone ke baad ki hai.");
  }
  const duplicate = await WorkDay.exists({
    roundId: round._id,
    date,
    deleted_at: null,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (duplicate) throw badRequest("Is din ka kaam pehle se add hai — usay edit karein.");
};

// Work order zinda ho (cancel/delete nahi) aur round mila.
const getActiveRound = async (roundId, workOrderId) => {
  const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null });
  if (!workOrder) throw badRequest("Work order not found or has been deleted.", 404);
  if (workOrder.status === "cancelled") throw badRequest("Cancelled work report mein kaam add nahi ho sakta.");

  const round = await SampleRound.findOne({ _id: roundId, workOrderId, deleted_at: null });
  if (!round) throw badRequest("Kaam ka round nahi mila.", 404);
  return round;
};

// POST /create-work-day — body: workOrderId, roundId, date (DD/MM/YYYY, default aaj), note
const createWorkDay = async (req, res) => {
  try {
    const { workOrderId, roundId, date, note } = req.body;

    if (!isValidObjectIdString(workOrderId) || !isValidObjectIdString(roundId)) {
      return res.status(400).json({ success: false, message: "Valid workOrderId aur roundId zaroori hain." });
    }

    const round = await getActiveRound(roundId, workOrderId);
    if (round.responseStatus !== "pending") {
      throw badRequest("Is round par client ka jawab aa chuka hai — is mein naya din add nahi ho sakta.");
    }

    const finalDate = resolveDay(date, new Date());
    await validateWorkDayDate(round, finalDate);

    const workDay = await WorkDay.create({
      workOrderId,
      roundId,
      date: finalDate,
      note: note?.trim() || "",
    });
    return res.status(201).json({ success: true, message: "Kaam ka din add ho gaya.", data: formatWorkDay(workDay) });
  } catch (error) {
    return sendError(res, error, "Error creating work day.");
  }
};

// PUT /update-work-day/:workDayId — body (optional): date, note
const updateWorkDay = async (req, res) => {
  try {
    const { workDayId } = req.params;
    const { date, note } = req.body;

    if (!isValidObjectIdString(workDayId)) {
      return res.status(400).json({ success: false, message: "Invalid work day id." });
    }

    const workDay = await WorkDay.findOne({ _id: workDayId, deleted_at: null });
    if (!workDay) {
      return res.status(404).json({ success: false, message: "Kaam ka din nahi mila." });
    }

    const round = await getActiveRound(workDay.roundId, workDay.workOrderId);
    if (round.responseStatus === "approved") {
      throw badRequest("Approved kaam ke din edit nahi ho sakte.");
    }

    if (date !== undefined) {
      workDay.date = resolveDay(date, workDay.date);
      await validateWorkDayDate(round, workDay.date, workDay._id);
    }
    if (note !== undefined) workDay.note = String(note).trim();

    await workDay.save();
    return res.status(200).json({ success: true, message: "Kaam ka din update ho gaya.", data: formatWorkDay(workDay) });
  } catch (error) {
    return sendError(res, error, "Error updating work day.");
  }
};

// DELETE /delete-work-day/:workDayId — soft delete
const deleteWorkDay = async (req, res) => {
  try {
    const { workDayId } = req.params;
    if (!isValidObjectIdString(workDayId)) {
      return res.status(400).json({ success: false, message: "Invalid work day id." });
    }

    const workDay = await WorkDay.findOne({ _id: workDayId, deleted_at: null });
    if (!workDay) {
      return res.status(404).json({ success: false, message: "Kaam ka din nahi mila ya pehle hi delete ho chuka hai." });
    }
    const round = await SampleRound.findOne({ _id: workDay.roundId, deleted_at: null });
    if (round?.responseStatus === "approved") {
      return res.status(400).json({ success: false, message: "Approved kaam ke din delete nahi ho sakte." });
    }

    workDay.deleted_at = new Date();
    await workDay.save();
    return res.status(200).json({ success: true, message: "Kaam ka din delete ho gaya." });
  } catch (error) {
    return sendError(res, error, "Error deleting work day.");
  }
};

export { createWorkDay, updateWorkDay, deleteWorkDay };
