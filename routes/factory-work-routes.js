import express from "express";
import {
  createFactoryWork,
  getAllFactoryWorks,
  getSingleFactoryWork,
  updateFactoryWork,
  addFactoryPayment,
  updateMaterialMovement,
  updateSiteArrival,
  setVehicleInfo,
  addVehiclePayment,
  deleteFactoryWork,
} from "../controllers/factory-work-controller.js";
import { authMiddleware } from "../middleware/admin-middle-ware.js";

const router = express.Router();

router.post("/create-work", authMiddleware, createFactoryWork);
router.get("/get-all-works", authMiddleware, getAllFactoryWorks);
router.get("/get-single-work/:workId", authMiddleware, getSingleFactoryWork);
router.put("/update-work/:workId", authMiddleware, updateFactoryWork);

router.post("/add-payment/:workId", authMiddleware, addFactoryPayment);
router.put("/material-movement/:workId", authMiddleware, updateMaterialMovement);
router.put("/site-arrival/:workId", authMiddleware, updateSiteArrival);

router.put("/vehicle-info/:workId", authMiddleware, setVehicleInfo);
router.post("/vehicle-payment/:workId", authMiddleware, addVehiclePayment);

router.delete("/delete-work/:workId", authMiddleware, deleteFactoryWork);

export default router;