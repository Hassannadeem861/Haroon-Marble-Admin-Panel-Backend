import express from "express";
import {
  createSalarySlip,
  getAllSalarySlips,
  getSingleSalarySlip,
} from "../controllers/salary-slip-controller.js";
// import upload from "../middleware/multer.js";

const router = express.Router();

router.post("/create-salary-slip", createSalarySlip);
router.get("/get-all-salary-slip", getAllSalarySlips);
router.get("/get-single-salary-slip/:salarySlipId", getSingleSalarySlip);
// router.put(
//   "/update-employer/:userId",
//   upload.fields([
//     { name: "fileUpload", maxCount: 1 },
//     { name: "pdfUpload", maxCount: 1 },
//   ]),
//   updateEmployer
// );
// router.delete("/delete-employer/:userId", deleteEmployer);

export default router;
