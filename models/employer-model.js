import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    attendence: {
      type: String,
      enum: ["present", "absent"],
      default: "absent",
    },

    overTime: {
      type: Number,
      default: 0,
    },

    salary: {
      type: Number,
      required: true,
    },

    designation: {
      type: String,
      enum: ["mazdoor", "qarigar"],
      required: true,
    },

    salaryType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "contract"],
      default: "daily",
    },

    employerType: {
      type: String,
      enum: ["owner", "partnerShip"],
      required: true,
    },

    currentSite: {
      type: String,
    },

    teamName: {
      type: String,
      default: "owner",
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

const User = mongoose.model("Employer", userSchema);
export default User;
