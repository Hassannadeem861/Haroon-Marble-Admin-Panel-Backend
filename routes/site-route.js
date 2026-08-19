import express from "express";
import {
  createSite,
  getAllSites,
  getSingleSite,
  updateSite,
  deleteSite,
  getSitesList,
} from "../controllers/site-controller.js";

const router = express.Router();

// static path pehle, dynamic ":siteId" baad mein
router.get("/sites-list", getSitesList);
router.get("/get-all-sites", getAllSites);
router.post("/create-site", createSite);
router.get("/get-single-site/:siteId", getSingleSite);
router.put("/update-site/:siteId", updateSite);
router.delete("/delete-site/:siteId", deleteSite);

export default router;