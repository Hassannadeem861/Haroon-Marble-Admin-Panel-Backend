import mongoose from "mongoose";

export const ISSUE_CAUSED_BY = ["client", "company", "material", "weather", "other"];
export const MAX_ISSUE_IMAGES = 5;

/**
 * SiteIssue — kaam ke dauran site par aane wali ek problem (photos ke sath).
 * Har issue ek WorkOrder aur us ke ek SampleRound (kaam ka round) se linked hai.
 * `resolvedDate` null = problem abhi jari hai. Delay ke din store nahi hote,
 * response bante waqt issueDate -> resolvedDate (ya aaj) se calculate hote hain.
 */
const issueImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: true },
);

const siteIssueSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
      index: true,
    },

    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SampleRound",
      required: true,
      index: true,
    },

    issueDate: {
      type: Date,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "Description 1000 characters se lambi nahi ho sakti."],
    },

    // Client ko proof dene ke liye — delay kis ki wajah se hua.
    causedBy: {
      type: String,
      enum: ISSUE_CAUSED_BY,
      default: "other",
    },

    images: {
      type: [issueImageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= MAX_ISSUE_IMAGES,
        message: `Zyada se zyada ${MAX_ISSUE_IMAGES} photos allowed hain.`,
      },
    },

    resolvedDate: {
      type: Date,
      default: null,
    },

    resolutionNote: {
      type: String,
      trim: true,
      default: "",
    },

    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

siteIssueSchema.index({ workOrderId: 1, issueDate: 1 });

const SiteIssue = mongoose.model("SiteIssue", siteIssueSchema);
export default SiteIssue;
