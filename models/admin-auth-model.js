import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true, select: false },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // created_at: {
    //   type: Date,
    //   default: null,
    // },

    // updated_at: {
    //   type: Date,
    //   default: null,
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
  }
);

const User = mongoose.model("Auth", userSchema);
export default User;
