import express from "express";
import {
  createWorkOrder,
  getAllWorkOrders,
  getSingleWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
} from "../controllers/work-order-controller.js";

const router = express.Router();

router.get("/get-all-work-orders", getAllWorkOrders);
router.post("/create-work-order", createWorkOrder);
router.get("/get-single-work-order/:workOrderId", getSingleWorkOrder);
router.put("/update-work-order/:workOrderId", updateWorkOrder);
router.delete("/delete-work-order/:workOrderId", deleteWorkOrder);

export default router;