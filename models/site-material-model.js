import mongoose from "mongoose";

/**
 * SiteMaterial — ek record = ek material jo site pe laaya gaya (usually
 * owner khud leke aata hai). Quantity + estimated Rs. value dono track
 * hoti hai, taake baad mein site ka total material cost pata chal sake.
 */
const siteMaterialSchema = new mongoose.Schema(
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

    materialName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative."],
    },

    unit: {
      type: String,
      trim: true,
      default: "", // e.g. "bags", "sq.ft", "pieces"
    },

    // Estimated Rs. value of the material — useful for accounting even
    // when the owner supplies it in-kind (no direct cash out at site).
    estimatedValue: {
      type: Number,
      default: 0,
      min: [0, "Estimated value cannot be negative."],
    },

    broughtBy: {
      type: String,
      enum: ["owner", "company", "vendor"],
      default: "owner",
    },

    notes: {
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

siteMaterialSchema.index({ siteId: 1, date: -1 });

const SiteMaterial = mongoose.model("SiteMaterial", siteMaterialSchema);
export default SiteMaterial;