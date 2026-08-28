import mongoose from "mongoose";

/**
 * WorkOrder — ek bada kaam (e.g. "2 mahine ka tiles/marble job").
 * Sample approval cycle SampleRound collection mein track hota hai,
 * workOrderId se linked (kyunki sample multiple baar reject ho sakta hai).
 */
const workOrderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    clientName: {
      type: String,
    //   required: true,
      trim: true,
    },

    // Optional — agar ye kaam kisi existing Site se juda hai.
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },

    status: {
      type: String,
      enum: ["pending_sample", "in_review", "approved", "in_progress", "completed", "cancelled"],
      default: "pending_sample",
      index: true,
    },

    // Set hota hai jab approved sample ke baad asal kaam shuru hota hai.
    workStartDate: {
      type: Date,
      default: null,
    },

    // expectedCompletionDate: {
    //   type: Date,
    //   default: null,
    // },

    actualCompletionDate: {
      type: Date,
      default: null,
    },

    description: {
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

workOrderSchema.index({ title: 1, status: 1 });

const WorkOrder = mongoose.model("WorkOrder", workOrderSchema);
export default WorkOrder;