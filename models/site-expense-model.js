import mongoose from "mongoose";

/**
 * SiteExpense — ek record = site pe ek kharcha (labor extra, transport,
 * chhoti-moti cheezein, misc). Har record kisi existing Site se linked hai.
 */
const siteExpenseSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    category: {
      type: String,
      enum: ["labor", "transport", "material", "misc", "other"],
      default: "misc",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative."],
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

siteExpenseSchema.index({ siteId: 1, date: -1 });

const SiteExpense = mongoose.model("SiteExpense", siteExpenseSchema);
export default SiteExpense;