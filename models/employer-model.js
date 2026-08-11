import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },

    workerId: {
      type: String,
      required: true,
      index: true,
    },

    description: {
      type: String,
    },

    advanced: {
      type: Number,
      default: 0,
    },

    salary: {
      type: Number,
      required: true,
    },

    overTime: {
      type: Number,
      default: 0,
    },

    designation: {
      type: String,
      enum: ["mazdoor", "qarigar"],
      // required: true,
    },

    // salaryType: {
    //   type: String,
    //   enum: ["daily", "weekly", "monthly", "contract"],
    //   default: "daily",
    // },

    workUnder: {
      type: String,
      enum: ["owner", "partnerShip", "client"],
      required: true,
      // index: true,
    },

    currentSite: {
      type: String,
    },

    workStatus: {
      type: String,
      enum: ["pending", "inprogress", "complete"],
      default: "pending",
    },

    attendence: {
      type: String,
      enum: ["present", "absent"],
      default: "absent",
    },

    entryDate: {
      type: Date,
      default: Date.now
    },

    // teamName: {
    //   type: String,
    //   default: "owner",
    // },

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