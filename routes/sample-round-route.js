import express from "express";
import { createSampleRound, updateSampleRound, deleteSampleRound } from "../controllers/sample-round-controller.js";

const router = express.Router();

router.post("/create-sample-round", createSampleRound);
router.put("/update-sample-round/:id", updateSampleRound);
router.delete("/delete-sample-round/:id", deleteSampleRound);

export default router;