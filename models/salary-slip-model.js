import mongoose from "mongoose";

const salarySlipSchema = mongoose.Schema(
  {
    employerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },

    // salaryAmount: {
    //   type: Number,
    //   required: true,
    // },

    month: {
      type: String,
      required: true,
    },

    created_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: false }
);

const salarySlip = mongoose.model("salary-slip", salarySlipSchema);
export default salarySlip;
