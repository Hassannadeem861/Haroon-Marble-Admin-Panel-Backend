import express from "express";
import {
  createLoan,
  getAllLoan,
  getSingleLoan,
  updateLoan,
  deleteLoan,
} from "../controllers/office-loan-controller.js";

const router = express.Router();

router.post("/create-loan", createLoan);
router.get("/get-all-loans", getAllLoan);
router.get("/get-single-loan/:officeLoanId", getSingleLoan);
router.put("/update-loan/:officeLoanId", updateLoan);
router.delete("/delete-loan/:officeLoanId", deleteLoan);

export default router