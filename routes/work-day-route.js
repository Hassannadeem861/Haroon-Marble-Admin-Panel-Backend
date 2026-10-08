import express from "express";
import { createWorkDay, updateWorkDay, deleteWorkDay } from "../controllers/work-day-controller.js";
import { authMiddleware } from "../middleware/admin-middle-ware.js";

const router = express.Router();

router.post("/create-work-day", authMiddleware, createWorkDay);
router.put("/update-work-day/:workDayId", authMiddleware, updateWorkDay);
router.delete("/delete-work-day/:workDayId", authMiddleware, deleteWorkDay);

export default router;
