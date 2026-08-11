import express from "express";
import {
  createEmployer,
  getAllStats,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
  getWorkerSalarySlip,
  getWorkersList
} from "../controllers/employer-controller.js";
import { authMiddleware } from "../middleware/admin-middle-ware.js";

const router = express.Router();

router.post("/create-employer", authMiddleware, createEmployer);
router.get("/dashboard", authMiddleware, getAllStats);
router.get("/get-all-employers", authMiddleware, getAllEmployers);
router.get("/get-single-employer/:userId", authMiddleware, getSingleEmployer);
router.get("/get-workers-list", authMiddleware, getWorkersList);          
router.get("/salary-slip/:workerId", authMiddleware, getWorkerSalarySlip); 
router.put("/update-employer/:userId", authMiddleware, updateEmployer);
router.delete("/delete-employer/:userId", authMiddleware, deleteEmployer);

export default router;
