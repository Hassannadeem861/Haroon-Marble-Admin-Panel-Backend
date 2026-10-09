import mongoose from "mongoose";
import SampleRound from "../models/sample-round-model.js";
import SiteIssue from "../models/site-issue-model.js";
import WorkDay from "../models/work-day-model.js";
import WorkOrder from "../models/work-order-model.js";
import { formatToDDMMYYYY, resolveEntryDate } from "../utils/date-helper-fun.js";
import { isValidObjectIdString, isMongooseInputError } from "../utils/validators.js";
import { getLatestRound, pakistanDayIndex, syncWorkOrderStatus } from "../utils/work-order-service.js";

/**
 * Naye flow mein ek SampleRound = kaam ka ek round (attempt):
 *   sampleStartDate  = Kaam shuru
 *   sampleReadyDate  = Kaam mukammal
 *   clientResponseDate + responseStatus + rejectionNotes = Client ka jawab
 * Reject hone par naya round (Rework) banta hai. DB field names purane hi hain.
 */
const RESPONSE_STATUSES = ["pending", "approved", "rejected"];

const formatRound = (doc) => ({
  ...doc.toObject(),
  sampleStartDate: formatToDDMMYYYY(doc.sampleStartDate),
  sampleReadyDate: formatToDDMMYYYY(doc.sampleReadyDate),
  sentToClientDate: formatToDDMMYYYY(doc.sentToClientDate),
  clientResponseDate: formatToDDMMYYYY(doc.clientResponseDate),
});

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const isFutureDate = (date) => date && date.getTime() > Date.now();

// start <= mukammal <= client jawab; koi bhi date future mein nahi.
const validateRoundDates = (round) => {
  const { sampleStartDate: start, sampleReadyDate: ready, clientResponseDate: response } = round;
  if ([start, ready, response].some(isFutureDate)) {
    throw badRequest("Aane wali (future) date nahi di ja sakti.");
  }
  if (start && ready && ready < start) {
    throw badRequest("Kaam mukammal hone ki date, kaam shuru hone ki date se pehle nahi ho sakti.");
  }
  if (ready && response && response < ready) {
    throw badRequest("Client ke jawab ki date, kaam mukammal hone ki date se pehle nahi ho sakti.");
  }
};

// Roz ke kaam (WorkDay) ke din round ki shuru aur mukammal date ke darmiyan hon (Pakistan ke din se).
const validateWorkDaysInRange = async (round, session) => {
  const days = await WorkDay.find({ roundId: round._id, deleted_at: null }).select("date").session(session).lean();
  if (!days.length) return;
  const dayIndexes = days.map((d) => pakistanDayIndex(d.date));
  if (round.sampleStartDate && Math.min(...dayIndexes) <= pakistanDayIndex(round.sampleStartDate)) {
    throw badRequest("Kaam shuru ki date, roz ke kaam ki pehli entry se pehle honi chahiye.");
  }
  if (round.sampleReadyDate && Math.max(...dayIndexes) > pakistanDayIndex(round.sampleReadyDate)) {
    const last = days[dayIndexes.indexOf(Math.max(...dayIndexes))];
    throw badRequest(`${formatToDDMMYYYY(last.date)} ka kaam add hai — mukammal date us se pehle nahi ho sakti.`);
  }
};

const sendError = (res, error, fallbackMessage) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (isMongooseInputError(error)) return res.status(400).json({ success: false, message: error.message });
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

// POST /create-sample-round — "Kaam Shuru" (pehla round) ya "Rework" (reject ke baad naya round).
const createSampleRound = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    const { workOrderId, workStartDate, sampleStartDate, description } = req.body;

    if (!workOrderId || !isValidObjectIdString(workOrderId)) {
      return res.status(400).json({ success: false, message: "Valid workOrderId is required." });
    }

    let round;
    await session.withTransaction(async () => {
      const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null }).session(session);
      if (!workOrder) {
        const err = new Error("Work order not found or has been deleted.");
        err.status = 404;
        throw err;
      }
      if (workOrder.status === "cancelled") throw badRequest("Cancelled work report par kaam shuru nahi ho sakta.");

      const latestRound = await getLatestRound(workOrderId, session);
      if (latestRound && latestRound.responseStatus !== "rejected") {
        throw badRequest(
          latestRound.responseStatus === "approved"
            ? "Ye kaam client approve kar chuka hai — naya round nahi ban sakta."
            : "Pehle wala round abhi khatam nahi hua.",
        );
      }

      // Soft-deleted rounds bhi gino taake roundNumber kabhi repeat na ho.
      const lastNumbered = await SampleRound.findOne({ workOrderId })
        .sort({ roundNumber: -1 })
        .select("roundNumber")
        .session(session);

      const startDate = resolveEntryDate(sampleStartDate || workStartDate, new Date());
      validateRoundDates({ sampleStartDate: startDate });

      [round] = await SampleRound.create(
        [
          {
            workOrderId,
            roundNumber: (lastNumbered?.roundNumber || 0) + 1,
            sampleStartDate: startDate,
            description: description?.trim() || "",
          },
        ],
        { session },
      );

      await syncWorkOrderStatus(workOrderId, session);
    });

    return res.status(201).json({
      success: true,
      message: round.roundNumber > 1 ? "Rework shuru ho gaya." : "Kaam shuru ho gaya.",
      data: formatRound(round),
    });
  } catch (error) {
    return sendError(res, error, "Error creating sample round.");
  } finally {
    await session?.endSession();
  }
};

// PUT /update-sample-round/:id — "Kaam Mukammal" (sampleReadyDate) ya "Client ka Jawab".
const updateSampleRound = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    const { id } = req.params;
    const {
      workStartDate,
      sampleStartDate,
      description,
      sampleReadyDate,
      sentToClientDate,
      clientResponseDate,
      responseStatus,
      rejectionNotes,
    } = req.body;

    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ success: false, message: "Invalid round id." });
    }
    if (responseStatus !== undefined && !RESPONSE_STATUSES.includes(responseStatus)) {
      return res.status(400).json({ success: false, message: "responseStatus must be pending, approved or rejected." });
    }

    let round;
    await session.withTransaction(async () => {
      round = await SampleRound.findOne({ _id: id, deleted_at: null }).session(session);
      if (!round) {
        const err = new Error("Sample round not found.");
        err.status = 404;
        throw err;
      }

      const workOrder = await WorkOrder.findOne({ _id: round.workOrderId, deleted_at: null }).session(session);
      if (!workOrder || workOrder.status === "cancelled") {
        throw badRequest("Ye work report cancel ya delete ho chuki hai.");
      }

      const latestRound = await getLatestRound(round.workOrderId, session);
      if (String(latestRound?._id) !== String(round._id)) {
        throw badRequest("Sirf aakhri (current) round edit ho sakta hai.");
      }
      if (round.responseStatus === "approved") {
        throw badRequest("Approved round edit nahi ho sakta.");
      }

      if (sampleStartDate !== undefined || workStartDate !== undefined) {
        round.sampleStartDate = resolveEntryDate(sampleStartDate || workStartDate, round.sampleStartDate);
      }
      if (description !== undefined) round.description = description.trim();
      if (sampleReadyDate !== undefined) {
        round.sampleReadyDate = sampleReadyDate === "" ? null : resolveEntryDate(sampleReadyDate, round.sampleReadyDate);
      }
      if (sentToClientDate !== undefined) {
        round.sentToClientDate = resolveEntryDate(sentToClientDate, round.sentToClientDate);
      }
      if (responseStatus !== undefined) round.responseStatus = responseStatus;
      if (rejectionNotes !== undefined) round.rejectionNotes = rejectionNotes.trim();

      if (round.responseStatus === "pending") {
        round.clientResponseDate = null;
      } else {
        if (!round.sampleReadyDate) {
          throw badRequest("Client ka jawab tab hi record hoga jab kaam mukammal ho chuka ho.");
        }
        round.clientResponseDate = resolveEntryDate(clientResponseDate, round.clientResponseDate || new Date());
      }

      if (round.responseStatus === "rejected" && !round.rejectionNotes) {
        throw badRequest("Reject ki wajah likhna zaroori hai.");
      }

      if (round.responseStatus === "approved") {
        const openIssues = await SiteIssue.countDocuments({
          roundId: round._id,
          deleted_at: null,
          resolvedDate: null,
        }).session(session);
        if (openIssues > 0) {
          throw badRequest(`Pehle ${openIssues} jari problem(s) ko "Hal ho gayi" mark karein, phir approve karein.`);
        }
      }

      validateRoundDates(round);
      await validateWorkDaysInRange(round, session);
      await round.save({ session });
      await syncWorkOrderStatus(round.workOrderId, session);
    });

    return res.status(200).json({ success: true, message: "Sample round updated successfully.", data: formatRound(round) });
  } catch (error) {
    return sendError(res, error, "Error updating sample round.");
  } finally {
    await session?.endSession();
  }
};

// DELETE /delete-sample-round/:id — soft delete (rare — mistaken entry only)
const deleteSampleRound = async (req, res) => {
  let session;
  try {
    session = await mongoose.startSession();
    const { id } = req.params;
    if (!isValidObjectIdString(id)) {
      return res.status(400).json({ success: false, message: "Invalid round id." });
    }

    let round;
    await session.withTransaction(async () => {
      round = await SampleRound.findOneAndUpdate(
        { _id: id, deleted_at: null },
        { deleted_at: new Date() },
        { new: true, session },
      );
      if (round) await syncWorkOrderStatus(round.workOrderId, session);
    });

    if (!round) {
      return res.status(404).json({ success: false, message: "Sample round not found or already deleted." });
    }
    return res.status(200).json({ success: true, message: "Sample round deleted successfully." });
  } catch (error) {
    return sendError(res, error, "Error deleting sample round.");
  } finally {
    await session?.endSession();
  }
};

export { createSampleRound, updateSampleRound, deleteSampleRound };
