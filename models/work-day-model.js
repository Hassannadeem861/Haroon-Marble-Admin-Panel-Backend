import mongoose from "mongoose";

/**
 * WorkDay — kaam ke ek round mein ek din ka kaam (daily log): "is din site par kaam hua" + note.
 * Round ka pehla din (SampleRound.sampleStartDate) yahan store nahi hota — wo round khud hai.
 * Ek round mein ek date sirf ek dafa. Purani dates allowed (mahine ka kaam ek din mein bhi add ho sake).
 */
const workDaySchema = new mongoose.Schema(
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

    date: {
      type: Date,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Note 1000 characters se lamba nahi ho sakta."],
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

workDaySchema.index({ roundId: 1, date: 1 });

const WorkDay = mongoose.model("WorkDay", workDaySchema);
export default WorkDay;
