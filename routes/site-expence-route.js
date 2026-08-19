import express from "express";
import {
  createSiteExpense,
  getAllSiteExpenses,
  updateSiteExpense,
  deleteSiteExpense,
} from "../controllers/site-expence-controller.js";

const router = express.Router();

router.post("/create-site-expense", createSiteExpense);
router.get("/get-all-site-expenses", getAllSiteExpenses);
router.put("/update-site-expense/:id", updateSiteExpense);
router.delete("/delete-site-expense/:id", deleteSiteExpense);

export default router;