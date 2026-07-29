import express from "express";
import {
  createEmployer,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
} from "../controllers/employer-controller.js";
import { authMiddleware } from "../middleware/admin-middle-ware.js";

const router = express.Router();

router.post("/create-employer",  createEmployer);
router.get("/get-all-employers",  getAllEmployers);
router.get("/get-single-employer/:userId",  getSingleEmployer);
router.put("/update-employer/:userId",  updateEmployer);
router.delete("/delete-employer/:userId",  deleteEmployer);

export default router;
