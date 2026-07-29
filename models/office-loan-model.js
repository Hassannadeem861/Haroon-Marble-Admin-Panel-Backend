import mongoose from "mongoose";

const LoanSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employer",
      required: true,
    },

    loan: {
      type: Number,
      required: true,
      default: 0,
    },

    reason: {
      type: String,
      required: true,
    },

    created_at: {
      type: Date,
      default: null,
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
  { timestamps: false }
);
const Loan = mongoose.model("Office-Loan", LoanSchema);
export default Loan;
