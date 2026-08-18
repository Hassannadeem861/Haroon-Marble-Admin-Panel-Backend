/**
 * BACKFILL SCRIPT: Recalculate overtimeAmount for all DailyWork records
 * ====================================================================
 *
 * This script fixes the bug where overtimeAmount was hardcoded to 0
 * during the migration. It recalculates overtimeAmount for all records
 * using the correct formula:
 *
 * overtimeAmount = (dailySalary / 8) * overtimeHours
 *
 * Usage:
 *   node scripts/backfillOvertimeAmount.js
 *
 * What it does:
 *   1. Connects to MongoDB
 *   2. Finds all DailyWork records
 *   3. For each record: recalculate overtimeAmount
 *   4. Updates the record in the database
 *   5. Reports summary of changes
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import DailyWork from "../models/daily-work-model.js";
import { calculateOvertimeAmount } from "../utils/salary-helper-fun.js";

dotenv.config();

const run = async () => {
  try {
    console.log("==============================================");
    console.log("   BACKFILL: RECALCULATE OVERTIME AMOUNTS");
    console.log("==============================================");

    // ===========================================================
    // CHECK ENV
    // ===========================================================

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    // ===========================================================
    // CONNECT
    // ===========================================================

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("\nMongoDB connected.");

    // ===========================================================
    // FETCH ALL RECORDS
    // ===========================================================

    const allRecords = await DailyWork.find({
      deleted_at: null,
    }).sort({ entryDate: 1 });

    console.log(`\nFound ${allRecords.length} active DailyWork records.`);

    // ===========================================================
    // RECALCULATE & UPDATE
    // ===========================================================

    let updatedCount = 0;
    let noChangeCount = 0;
    const errors = [];

    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i];

      try {
        const salary = Number(record.salary) || 0;
        const overtimeHours = Number(record.overtimeHours) || 0;

        // Calculate correct amount
        const correctOvertimeAmount = calculateOvertimeAmount(
          salary,
          overtimeHours
        );

        const currentOvertimeAmount =
          Number(record.overtimeAmount) || 0;

        // Check if update needed
        if (Math.abs(correctOvertimeAmount - currentOvertimeAmount) > 0.01) {
          // Update the record
          record.overtimeAmount = correctOvertimeAmount;
          await record.save();

          updatedCount++;

          if (updatedCount <= 5 || updatedCount % 100 === 0) {
            console.log(
              `[${i + 1}/${allRecords.length}] ` +
              `Updated: ${record.employerId} | ` +
              `Date: ${record.entryDate.toISOString().split("T")[0]} | ` +
              `Salary: ${salary} | ` +
              `OT Hours: ${overtimeHours} | ` +
              `Old Amount: ${currentOvertimeAmount} → ` +
              `New Amount: ${correctOvertimeAmount}`
            );
          }
        } else {
          noChangeCount++;
        }
      } catch (err) {
        errors.push({
          recordId: record._id,
          error: err.message,
        });
        console.error(
          `ERROR updating record ${record._id}: ${err.message}`
        );
      }
    }

    // ===========================================================
    // SUMMARY
    // ===========================================================

    console.log("\n==============================================");
    console.log("   BACKFILL COMPLETE");
    console.log("==============================================");
    console.log(`Total records processed: ${allRecords.length}`);
    console.log(`Records updated:        ${updatedCount}`);
    console.log(`Records unchanged:      ${noChangeCount}`);
    console.log(`Errors:                 ${errors.length}`);

    if (errors.length > 0) {
      console.log("\nErrors encountered:");
      errors.forEach((e) => {
        console.log(`  - ${e.recordId}: ${e.error}`);
      });
    }

    console.log("\nBackfill complete! ✓");
  } catch (error) {
    console.error("\nFATAL ERROR:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB disconnected.");
  }
};

// Run the backfill
run().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
