import express from "express";
import {
  createEmployer,
  getAllEmployers,
  getSingleEmployer,
  updateEmployer,
  deleteEmployer,
} from "../controllers/employer-controller.js";
import upload from "../middleware/multer.js";

const router = express.Router();

router.post(
  "/create-employer",
  upload.fields([
    { name: "fileUpload", maxCount: 1 },
    { name: "pdfUpload", maxCount: 1 },
  ]),
  createEmployer
);
router.get("/get-all-employers", getAllEmployers);
router.get("/get-single-employer/:userId", getSingleEmployer);
router.put(
  "/update-employer/:userId",
  upload.fields([
    { name: "fileUpload", maxCount: 1 },
    { name: "pdfUpload", maxCount: 1 },
  ]),
  updateEmployer
);
router.delete("/delete-employer/:userId", deleteEmployer);

export default router;
