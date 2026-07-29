import express from "express";
import {
  createRevenue,
  getAllRevenues,
  getSingleRevenue,
  updateRevenue,
  deleteRevenue,
} from "../controllers/revenue-controller.js";

const router = express.Router();

router.post("/create-revenue", createRevenue);
router.get("/get-all-revenues", getAllRevenues);
router.get("/get-single-revenue/:revenueId", getSingleRevenue);
router.put("/update-revenue/:revenueId", updateRevenue);
router.delete("/delete-revenue/:revenueId", deleteRevenue);

export default router;
