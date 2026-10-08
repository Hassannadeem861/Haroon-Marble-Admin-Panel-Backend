import mongoose from "mongoose";

/**
 * Session — ek login (ek device / browser) ka refresh token.
 * Token khud kabhi store nahi hota, sirf us ka SHA-256 hash (DB leak ho to bhi token kaam ka nahi).
 * Har refresh par purana session revoke hota hai aur naya banta hai (rotation); `replacedByHash`
 * se pata chalta hai ke revoke rotation se hua. Expire hone par MongoDB TTL index record khud
 * mita deta hai — ye business data nahi, is liye soft delete ki zaroorat nahi.
 */
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    replacedByHash: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model("Session", sessionSchema);
export default Session;
