import express from "express";
import {
  createSiteMaterial,
  getAllSiteMaterials,
  updateSiteMaterial,
  deleteSiteMaterial,
} from "../controllers/site-material-controller.js";

const router = express.Router();

router.post("/create-site-material", createSiteMaterial);
router.get("/get-all-site-materials", getAllSiteMaterials);
router.put("/update-site-material/:id", updateSiteMaterial);
router.delete("/delete-site-material/:id", deleteSiteMaterial);

export default router;