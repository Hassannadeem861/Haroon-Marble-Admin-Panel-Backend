import express from "express";
import {
  createDailyWork,
  getAllDailyWork,
  getSingleDailyWork,
  updateDailyWork,
  deleteDailyWork,
} from "../controllers/daliy-work-controller.js";

const router = express.Router();

// POST /create-daily-work
router.post("/create-daily-work", createDailyWork);

// GET /get-all-daily-work — filters: date, startDate, endDate, employerId, site, attendance, workStatus, worker
router.get("/get-all-daily-work", getAllDailyWork);

// GET /get-single-daily-work/:id
router.get("/get-single-daily-work/:id", getSingleDailyWork);

// PUT /update-daily-work/:id
router.put("/update-daily-work/:id", updateDailyWork);

// DELETE /delete-daily-work/:id — soft delete
router.delete("/delete-daily-work/:id", deleteDailyWork);

export default router;