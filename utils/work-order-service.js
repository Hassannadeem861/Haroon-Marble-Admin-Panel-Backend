import SampleRound from "../models/sample-round-model.js";
import SiteIssue from "../models/site-issue-model.js";
import WorkOrder from "../models/work-order-model.js";
import { formatToDDMMYYYY } from "./date-helper-fun.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const PAKISTAN_OFFSET_MS = 5 * 60 * 60 * 1000;

// Pakistan calendar ka din number — taake "aaj ki problem" shaam ko bhi 0 din dikhaye, 1 nahi.
const pakistanDayIndex = (date) => Math.floor((new Date(date).getTime() + PAKISTAN_OFFSET_MS) / DAY_MS);

const daysBetween = (from, to) => {
  if (!from || !to) return null;
  return Math.max(pakistanDayIndex(to) - pakistanDayIndex(from), 0);
};

// Issue ke din: issueDate -> resolvedDate (ya aaj tak, agar abhi jari hai).
const issueDelayDays = (issue) => daysBetween(issue.issueDate, issue.resolvedDate || new Date());

export const formatSiteIssue = (issue) => {
  const plain = typeof issue.toObject === "function" ? issue.toObject() : issue;
  return {
    ...plain,
    issueDate: formatToDDMMYYYY(plain.issueDate),
    resolvedDate: formatToDDMMYYYY(plain.resolvedDate),
    isResolved: !!plain.resolvedDate,
    delayDays: issueDelayDays(plain),
  };
};

// Aakhri (latest) non-deleted round — naye flow mein sirf yahi "active" ho sakta hai.
export const getLatestRound = (workOrderId, session = null) =>
  SampleRound.findOne({ workOrderId, deleted_at: null }).sort({ roundNumber: -1 }).session(session);

// Round ka status kis WorkOrder status ke barabar hai.
const statusFromRound = (round) => {
  if (!round) return "pending_sample";
  if (round.responseStatus === "approved") return "approved";
  if (round.responseStatus === "rejected") return "rework_required";
  if (round.sampleReadyDate) return "in_review";
  return "in_progress";
};

/**
 * syncWorkOrderStatus(workOrderId, session?)
 * ---------------------------------------------------------------
 * WorkOrder.status, workStartDate aur actualCompletionDate ko rounds se
 * derive karta hai — single source of truth. Har round create/update/delete
 * ke baad (usi transaction mein) call karo. Cancelled order ko nahi chhedta.
 */
export const syncWorkOrderStatus = async (workOrderId, session = null) => {
  const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null }).session(session);
  if (!workOrder || workOrder.status === "cancelled") return workOrder;

  const rounds = await SampleRound.find({ workOrderId, deleted_at: null })
    .sort({ roundNumber: 1 })
    .session(session)
    .lean();
  const firstRound = rounds[0] || null;
  const latestRound = rounds[rounds.length - 1] || null;

  workOrder.status = statusFromRound(latestRound);
  workOrder.workStartDate = firstRound?.sampleStartDate || null;
  workOrder.actualCompletionDate =
    latestRound?.responseStatus === "approved" ? latestRound.sampleReadyDate || latestRound.clientResponseDate : null;

  await workOrder.save({ session });
  return workOrder;
};

/**
 * getWorkOrderTimeline(workOrderId, workOrder)
 * ---------------------------------------------------------------
 * Har round (oldest first) us ke issues ke sath, plus report ke stats —
 * yahi "proof to client" PDF ko chahiye: kaam kab shuru/mukammal hua,
 * kitni problems aayin, kitne din ruka, aur kitna delay client ki wajah se tha.
 */
export const getWorkOrderTimeline = async (workOrderId, workOrder) => {
  const [rounds, issues] = await Promise.all([
    SampleRound.find({ workOrderId, deleted_at: null }).sort({ roundNumber: 1 }).lean(),
    SiteIssue.find({ workOrderId, deleted_at: null }).sort({ issueDate: 1, created_at: 1 }).lean(),
  ]);

  const roundIds = new Set(rounds.map((r) => String(r._id)));
  const visibleIssues = issues.filter((i) => roundIds.has(String(i.roundId)));

  const formattedRounds = rounds.map((r) => ({
    ...r,
    sampleStartDate: formatToDDMMYYYY(r.sampleStartDate),
    sampleReadyDate: formatToDDMMYYYY(r.sampleReadyDate),
    sentToClientDate: formatToDDMMYYYY(r.sentToClientDate),
    clientResponseDate: formatToDDMMYYYY(r.clientResponseDate),
    daysToRespond: daysBetween(r.sampleReadyDate, r.clientResponseDate),
    workDays: r.sampleStartDate ? daysBetween(r.sampleStartDate, r.sampleReadyDate || new Date()) : null,
    issues: visibleIssues.filter((i) => String(i.roundId) === String(r._id)).map(formatSiteIssue),
  }));

  const firstRound = rounds[0] || null;
  const latestRound = rounds[rounds.length - 1] || null;
  const approvedRound = rounds.find((r) => r.responseStatus === "approved") || null;

  const totalIssueDelayDays = visibleIssues.reduce((sum, i) => sum + (issueDelayDays(i) || 0), 0);
  const clientCausedDelayDays = visibleIssues
    .filter((i) => i.causedBy === "client")
    .reduce((sum, i) => sum + (issueDelayDays(i) || 0), 0);

  const projectEnd = approvedRound?.clientResponseDate || workOrder?.actualCompletionDate || new Date();

  return {
    rounds: formattedRounds,
    stats: {
      totalRounds: rounds.length,
      rejectedCount: rounds.filter((r) => r.responseStatus === "rejected").length,
      totalIssues: visibleIssues.length,
      openIssues: visibleIssues.filter((i) => !i.resolvedDate).length,
      totalIssueDelayDays,
      clientCausedDelayDays,
      workStartDate: formatToDDMMYYYY(firstRound?.sampleStartDate),
      workCompletedDate: formatToDDMMYYYY(latestRound?.sampleReadyDate),
      approvedDate: formatToDDMMYYYY(approvedRound?.clientResponseDate),
      totalDurationDays: firstRound?.sampleStartDate ? daysBetween(firstRound.sampleStartDate, projectEnd) : null,
    },
  };
};
