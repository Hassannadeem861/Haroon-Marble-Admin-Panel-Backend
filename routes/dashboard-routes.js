import express from "express";
import { getDashboardSummary } from "../controllers/dashboard-controller.js";

const router = express.Router();

router.get("/dashboard-summary", getDashboardSummary);

export default router;