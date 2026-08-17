import mongoose from "mongoose";

/**
 * Employer / Worker MASTER profile.
 * Ek worker ka sirf EK record hota hai. Daily attendance/advance/overtime/
 * site/workStatus is model mein NAHI aati — wo sab DailyWork model mein hai.
 */
const employerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    workerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    designation: {
      type: String,
      enum: ["mazdoor", "qarigar"],
      required: true,
    },

    // Normal/base daily rate. DailyWork apni salary khud store karega,
    // taake future rate-change se purani history na badle.
    salary: {
      type: Number,
      required: true,
      min: [0, "Salary cannot be negative."],
    },

    entryDate: {
      type: Date,
      default: Date.now,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
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

employerSchema.index({ name: 1, status: 1 });

const Employer = mongoose.model("Employer", employerSchema);
export default Employer;