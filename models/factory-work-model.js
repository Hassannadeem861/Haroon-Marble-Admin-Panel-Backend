import mongoose from "mongoose";

// Har payment entry — advance ya baad ka payment (Final Payment bhi isi type "payment" se aayega)
const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    type: { type: String, enum: ["advance", "payment"], required: true },
    date: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: true },
);

// Vehicle/Transport — ek factory work ke sath ek vehicle entry
const vehicleSchema = new mongoose.Schema(
  {
    vehicleType: { type: String },       // e.g. "Suzuki"
    totalRent: { type: Number },
    payments: [paymentEntrySchema],       // advance + final payment isi array mein
    pickupDate: { type: Date },
    arrivalDate: { type: Date },
    status: {
      type: String,
      enum: ["pending", "on_the_way", "arrived", "paid"],
      default: "pending",
    },
    notes: { type: String },
  },
  { _id: false },
);

vehicleSchema.virtual("totalPaid").get(function () {
  return (this.payments || []).reduce((sum, p) => sum + p.amount, 0);
});
vehicleSchema.virtual("remainingAmount").get(function () {
  return (this.totalRent || 0) - this.totalPaid;
});
vehicleSchema.virtual("paymentStatus").get(function () {
  if (this.totalPaid <= 0) return "unpaid";
  if (this.totalPaid < (this.totalRent || 0)) return "partially_paid";
  return "fully_paid";
});
vehicleSchema.set("toJSON", { virtuals: true });
vehicleSchema.set("toObject", { virtuals: true });

const factoryWorkSchema = new mongoose.Schema(
  {
    factoryName: { type: String, required: true },
    workMaterialName: { type: String, required: true },
    quantity: { type: String },          // "1000 sq.ft" — free text, units vary
    totalAmount: { type: Number, required: true },
    expectedCompletionDate: { type: Date },
    notes: { type: String },

    status: {
      type: String,
      enum: [
        "pending", "in_factory", "ready", "on_the_way",
        "received", "checked", "completed",
      ],
      default: "pending",
    },

    payments: [paymentEntrySchema],       // 1st entry (advance) + final payment yahin aata hai

    materialMovement: {
      leftFactoryDate: { type: Date },
      vehicleUsed: { type: String },
      notes: { type: String },
    },

    siteArrival: {
      arrivalDate: { type: Date },
      materialChecked: {
        type: String,
        enum: ["received", "checked", "issue_found"],
      },
      notes: { type: String },
    },

    vehicle: vehicleSchema,

    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

factoryWorkSchema.virtual("totalPaid").get(function () {
  return (this.payments || []).reduce((sum, p) => sum + p.amount, 0);
});
factoryWorkSchema.virtual("remainingAmount").get(function () {
  return (this.totalAmount || 0) - this.totalPaid;
});
factoryWorkSchema.virtual("paymentStatus").get(function () {
  if (this.totalPaid <= 0) return "unpaid";
  if (this.totalPaid < (this.totalAmount || 0)) return "partially_paid";
  return "fully_paid";
});
factoryWorkSchema.set("toJSON", { virtuals: true });
factoryWorkSchema.set("toObject", { virtuals: true });

const FactoryWork = mongoose.model("FactoryWork", factoryWorkSchema);
export default FactoryWork;