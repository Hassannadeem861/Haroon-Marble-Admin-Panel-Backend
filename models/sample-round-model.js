import mongoose from "mongoose";

/**
 * SampleRound — ek record = ek sample attempt for a WorkOrder.
 * Agar sample reject hota hai, naya round (roundNumber+1) banta hai —
 * isliye poora reject/redesign history preserve rehti hai.
 */
const sampleRoundSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkOrder",
      required: true,
      index: true,
    },

    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    sampleStartDate: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    sampleReadyDate: {
      type: Date,
      default: null,
    },

    sentToClientDate: {
      type: Date,
      default: null,
    },

    clientResponseDate: {
      type: Date,
      default: null,
    },

    responseStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    rejectionNotes: {
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

sampleRoundSchema.index({ workOrderId: 1, roundNumber: 1 });

const SampleRound = mongoose.model("SampleRound", sampleRoundSchema);
export default SampleRound;