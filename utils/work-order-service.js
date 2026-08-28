import SampleRound from "../models/sample-round-model.js";
import { formatToDDMMYYYY } from "./date-helper-fun.js";

const daysBetween = (from, to) => {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(Math.round(ms / (1000 * 60 * 60 * 24)), 0);
};

/**
 * getWorkOrderTimeline(workOrderId, workOrder)
 * ---------------------------------------------------------------
 * Returns every SampleRound (oldest first) plus duration stats — this is
 * exactly what the "proof to client" report/PDF needs: kitna time sample
 * approval mein laga, kitna time approval se work-start tak, aur kitna
 * time abhi tak kaam mein laga.
 */
export const getWorkOrderTimeline = async (workOrderId, workOrder) => {
  const rounds = await SampleRound.find({ workOrderId, deleted_at: null })
    .sort({ roundNumber: 1 })
    .lean();

  const formattedRounds = rounds.map((r) => ({
    ...r,
    sampleStartDate: formatToDDMMYYYY(r.sampleStartDate),
    sampleReadyDate: formatToDDMMYYYY(r.sampleReadyDate),
    sentToClientDate: formatToDDMMYYYY(r.sentToClientDate),
    clientResponseDate: formatToDDMMYYYY(r.clientResponseDate),
    daysToRespond: daysBetween(r.sentToClientDate, r.clientResponseDate),
  }));

  const firstRound = rounds[0] || null;
  const approvedRound = rounds.find((r) => r.responseStatus === "approved") || null;
  const rejectedCount = rounds.filter((r) => r.responseStatus === "rejected").length;

  const daysInSamplePhase = firstRound && approvedRound
    ? daysBetween(firstRound.sampleReadyDate, approvedRound.clientResponseDate)
    : null;

  const daysApprovalToStart = approvedRound && workOrder.workStartDate
    ? daysBetween(approvedRound.clientResponseDate, workOrder.workStartDate)
    : null;

  const daysInProgress = workOrder.workStartDate
    ? daysBetween(workOrder.workStartDate, workOrder.actualCompletionDate || new Date())
    : null;

  const totalDurationDays = firstRound
    ? daysBetween(firstRound.sampleReadyDate, workOrder.actualCompletionDate || new Date())
    : null;

  return {
    rounds: formattedRounds,
    stats: {
      totalRounds: rounds.length,
      rejectedCount,
      daysInSamplePhase,
      daysApprovalToStart,
      daysInProgress,
      totalDurationDays,
    },
  };
};