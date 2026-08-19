import mongoose from "mongoose";

/**
 * Site — MASTER profile for a construction/marble-fitting site.
 * Expenses aur material entries is model mein NAHI aatin — wo alag
 * SiteExpense / SiteMaterial collections mein hain, siteId se linked.
 */
const siteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    ownerName: {
      type: String,
      trim: true,
      default: "",
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["active", "completed", "on_hold"],
      default: "active",
      index: true,
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

siteSchema.index({ name: 1, status: 1 });

const Site = mongoose.model("Site", siteSchema);
export default Site;