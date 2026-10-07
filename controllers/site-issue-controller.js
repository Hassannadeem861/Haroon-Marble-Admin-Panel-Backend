import SiteIssue, { ISSUE_CAUSED_BY, MAX_ISSUE_IMAGES } from "../models/site-issue-model.js";
import SampleRound from "../models/sample-round-model.js";
import WorkOrder from "../models/work-order-model.js";
import { resolveEntryDate } from "../utils/date-helper-fun.js";
import { isValidObjectIdString, isMongooseInputError } from "../utils/validators.js";
import { uploadFileOnCloudinary, deleteImg } from "../utils/cloudinary.js";
import { removeTempFiles } from "../middleware/multer-middleware.js";
import { formatSiteIssue } from "../utils/work-order-service.js";

const badRequest = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isFutureDate = (date) => date && date.getTime() > Date.now();

const sendError = (res, error, fallbackMessage) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (isMongooseInputError(error)) return res.status(400).json({ success: false, message: error.message });
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

const deleteCloudinaryImages = (images) => Promise.allSettled(images.map((img) => deleteImg(img.publicId)));

/**
 * Saari photos ek sath (parallel) Cloudinary par. Atomic: ek bhi fail ho to jo
 * upload ho chuki unhe bhi delete karo, taake aadhi/bekaar photos na bachen.
 */
const uploadImages = async (files = []) => {
  const results = await Promise.allSettled(files.map((file) => uploadFileOnCloudinary(file.path)));
  const uploaded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const failed = results.find((r) => r.status === "rejected");

  if (failed) {
    await deleteCloudinaryImages(uploaded);
    console.error("Cloudinary upload failed:", failed.reason?.message);
    if (failed.reason?.http_code === 400) {
      throw badRequest("Koi photo kharab hai ya support nahi hoti. Sirf JPG, PNG ya WEBP photo lagayen.");
    }
    throw badRequest("Photos upload nahi ho sakin. Internet check karke dobara koshish karein.", 502);
  }
  return uploaded;
};

// multipart mein list ya to JSON string aati hai ya same field kai dafa.
const parseIdList = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(parseIdList);
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return parseIdList(JSON.parse(value));
    } catch {
      throw badRequest("removeImageIds format galat hai.");
    }
  }
  return [String(value)];
};

// Issue add/edit sirf tab jab round "active" ho (shuru ho chuka, client ka jawab abhi nahi aaya).
const getEditableRound = async (roundId, workOrderId) => {
  const round = await SampleRound.findOne({ _id: roundId, workOrderId, deleted_at: null });
  if (!round) throw badRequest("Kaam ka round nahi mila.", 404);
  return round;
};

// POST /create-site-issue — multipart/form-data (text fields + "images")
const createSiteIssue = async (req, res) => {
  const files = req.files || [];
  try {
    const { workOrderId, roundId, issueDate, description, causedBy } = req.body;

    if (!isValidObjectIdString(workOrderId) || !isValidObjectIdString(roundId)) {
      return res.status(400).json({ success: false, message: "Valid workOrderId aur roundId zaroori hain." });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: "Problem ki wajah likhna zaroori hai." });
    }
    if (causedBy !== undefined && causedBy !== "" && !ISSUE_CAUSED_BY.includes(causedBy)) {
      return res.status(400).json({ success: false, message: `causedBy sirf ye ho sakta hai: ${ISSUE_CAUSED_BY.join(", ")}` });
    }

    const workOrder = await WorkOrder.findOne({ _id: workOrderId, deleted_at: null });
    if (!workOrder) {
      return res.status(404).json({ success: false, message: "Work order not found or has been deleted." });
    }
    if (workOrder.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Cancelled work report par problem add nahi ho sakti." });
    }

    const round = await getEditableRound(roundId, workOrderId);
    if (round.responseStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Is round par client ka jawab aa chuka hai — naya round shuru karke problem add karein.",
      });
    }

    const finalIssueDate = resolveEntryDate(issueDate, new Date());
    if (isFutureDate(finalIssueDate)) {
      return res.status(400).json({ success: false, message: "Problem ki date aane wali (future) nahi ho sakti." });
    }
    if (round.sampleStartDate && finalIssueDate < round.sampleStartDate) {
      return res.status(400).json({ success: false, message: "Problem ki date kaam shuru hone se pehle nahi ho sakti." });
    }

    const images = await uploadImages(files);

    try {
      const issue = await SiteIssue.create({
        workOrderId,
        roundId,
        issueDate: finalIssueDate,
        description: description.trim(),
        causedBy: causedBy || "other",
        images,
      });
      return res.status(201).json({ success: true, message: "Problem save ho gayi.", data: formatSiteIssue(issue) });
    } catch (dbError) {
      await deleteCloudinaryImages(images);
      throw dbError;
    }
  } catch (error) {
    return sendError(res, error, "Error creating site issue.");
  } finally {
    await removeTempFiles(files);
  }
};

// PUT /update-site-issue/:issueId — multipart/form-data
// Fields (sab optional): issueDate, description, causedBy, resolvedDate ("" = dobara open),
// resolutionNote, removeImageIds (image _id list), images (nayi photos).
const updateSiteIssue = async (req, res) => {
  const files = req.files || [];
  try {
    const { issueId } = req.params;
    const { issueDate, description, causedBy, resolvedDate, resolutionNote, removeImageIds } = req.body;

    if (!isValidObjectIdString(issueId)) {
      return res.status(400).json({ success: false, message: "Invalid issue id." });
    }
    if (causedBy !== undefined && !ISSUE_CAUSED_BY.includes(causedBy)) {
      return res.status(400).json({ success: false, message: `causedBy sirf ye ho sakta hai: ${ISSUE_CAUSED_BY.join(", ")}` });
    }
    if (description !== undefined && !description.trim()) {
      return res.status(400).json({ success: false, message: "Problem ki wajah khali nahi ho sakti." });
    }

    const issue = await SiteIssue.findOne({ _id: issueId, deleted_at: null });
    if (!issue) {
      return res.status(404).json({ success: false, message: "Problem nahi mili." });
    }

    const workOrder = await WorkOrder.findOne({ _id: issue.workOrderId, deleted_at: null });
    if (!workOrder || workOrder.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Ye work report cancel ya delete ho chuki hai." });
    }
    const round = await getEditableRound(issue.roundId, issue.workOrderId);
    if (round.responseStatus === "approved") {
      return res.status(400).json({ success: false, message: "Approved kaam ki problems edit nahi ho saktin." });
    }

    const removeIds = parseIdList(removeImageIds);
    const imagesToRemove = issue.images.filter((img) => removeIds.includes(String(img._id)));
    const keptImages = issue.images.filter((img) => !removeIds.includes(String(img._id)));
    if (keptImages.length + files.length > MAX_ISSUE_IMAGES) {
      return res.status(400).json({ success: false, message: `Zyada se zyada ${MAX_ISSUE_IMAGES} photos lag sakti hain.` });
    }

    if (issueDate !== undefined) issue.issueDate = resolveEntryDate(issueDate, issue.issueDate);
    if (description !== undefined) issue.description = description.trim();
    if (causedBy !== undefined) issue.causedBy = causedBy;
    if (resolutionNote !== undefined) issue.resolutionNote = resolutionNote.trim();
    if (resolvedDate !== undefined) {
      issue.resolvedDate = resolvedDate === "" ? null : resolveEntryDate(resolvedDate, issue.resolvedDate);
    }

    if (isFutureDate(issue.issueDate) || isFutureDate(issue.resolvedDate)) {
      return res.status(400).json({ success: false, message: "Aane wali (future) date nahi di ja sakti." });
    }
    if (round.sampleStartDate && issue.issueDate < round.sampleStartDate) {
      return res.status(400).json({ success: false, message: "Problem ki date kaam shuru hone se pehle nahi ho sakti." });
    }
    if (issue.resolvedDate && issue.resolvedDate < issue.issueDate) {
      return res.status(400).json({ success: false, message: "Hal hone ki date, problem ki date se pehle nahi ho sakti." });
    }

    // Order: nayi photos upload -> DB save -> (save kamyab hone ke BAAD) hatayi gayi photos delete.
    // Is tarah DB kabhi kisi deleted photo ko point nahi karta.
    const newImages = await uploadImages(files);
    issue.images = [...keptImages, ...newImages];

    try {
      await issue.save();
    } catch (dbError) {
      await deleteCloudinaryImages(newImages);
      throw dbError;
    }

    if (imagesToRemove.length > 0) await deleteCloudinaryImages(imagesToRemove);

    return res.status(200).json({ success: true, message: "Problem update ho gayi.", data: formatSiteIssue(issue) });
  } catch (error) {
    return sendError(res, error, "Error updating site issue.");
  } finally {
    await removeTempFiles(files);
  }
};

// DELETE /delete-site-issue/:issueId — soft delete. Photos Cloudinary par rehti hain
// (client ke sath jhagre mein saboot) — sirf record chhup jata hai.
const deleteSiteIssue = async (req, res) => {
  try {
    const { issueId } = req.params;
    if (!isValidObjectIdString(issueId)) {
      return res.status(400).json({ success: false, message: "Invalid issue id." });
    }

    const issue = await SiteIssue.findOne({ _id: issueId, deleted_at: null });
    if (!issue) {
      return res.status(404).json({ success: false, message: "Problem nahi mili ya pehle hi delete ho chuki hai." });
    }
    const round = await SampleRound.findOne({ _id: issue.roundId, deleted_at: null });
    if (round?.responseStatus === "approved") {
      return res.status(400).json({ success: false, message: "Approved kaam ki problems delete nahi ho saktin." });
    }

    issue.deleted_at = new Date();
    await issue.save();
    return res.status(200).json({ success: true, message: "Problem delete ho gayi." });
  } catch (error) {
    return sendError(res, error, "Error deleting site issue.");
  }
};

export { createSiteIssue, updateSiteIssue, deleteSiteIssue };
