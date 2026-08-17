import express from "express";
import {
  createEmployer,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
  getWorkersList,
  getEmployerSalarySlip,
} from "../controllers/employer-controller.js";

const router = express.Router();

// NOTE: route order matters — a static path like "/workers-list" must be
// declared BEFORE the "/:employerId" dynamic routes, otherwise Express will
// treat "workers-list" as an :employerId value and 404/500 in getSingleEmployer.

// GET /workers-list — active workers for the DailyWork form dropdown
router.get("/workers-list", getWorkersList);

// GET /get-all-employers — list, search, paginate
router.get("/get-all-employers", getAllEmployers);

// POST /create-employer
router.post("/create-employer", createEmployer);

// GET /get-single-employer/:employerId — profile + daily history + summary
router.get("/get-single-employer/:employerId", getSingleEmployer);

// PUT /update-employer/:employerId — master profile only
router.put("/update-employer/:employerId", updateEmployer);

// DELETE /delete-employer/:employerId — soft delete
router.delete("/delete-employer/:employerId", deleteEmployer);

// GET /salary-slip/:employerId?startDate=&endDate=
router.get("/salary-slip/:employerId", getEmployerSalarySlip);

export default router;