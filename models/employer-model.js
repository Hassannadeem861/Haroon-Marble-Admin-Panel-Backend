import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: Number,
      default: 1,
    },

    mobile_number: {
      type: String,
      required: true,
    },

    designation: {
      type: String,
      required: true,
    },

    permanent_address: {
      type: String,
      required: true,
    },

    salary: {
      type: Number,
      required: true,
    },

    fileUpload: {
      type: Buffer,
      // type: String,
      default: null,
      // required: true,
    },

    created_at: {
      type: Date,
      default: () => new Date(),
    },

    updated_at: {
      type: Date,
      default: null,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: false,
  }
);

const User = mongoose.model("Employer", userSchema);
export default User;
