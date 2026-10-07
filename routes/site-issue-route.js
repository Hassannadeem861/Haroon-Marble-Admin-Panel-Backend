import express from "express";
import { createSiteIssue, updateSiteIssue, deleteSiteIssue } from "../controllers/site-issue-controller.js";
import { authMiddleware } from "../middleware/admin-middle-ware.js";
import { uploadIssueImages } from "../middleware/multer-middleware.js";

const router = express.Router();

// authMiddleware pehle — bina login koi file server tak na pohanche.
router.post("/create-site-issue", authMiddleware, uploadIssueImages, createSiteIssue);
router.put("/update-site-issue/:issueId", authMiddleware, uploadIssueImages, updateSiteIssue);
router.delete("/delete-site-issue/:issueId", authMiddleware, deleteSiteIssue);

export default router;
