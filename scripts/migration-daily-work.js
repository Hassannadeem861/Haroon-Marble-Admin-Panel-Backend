/**
 * SAFE FRESH MIGRATION
 * ---------------------------------------------------------------
 * OLD:
 *   employers1232344354554
 *
 * NEW:
 *   employers
 *   dailyworks
 *
 * Worker identification:
 *   ONLY normalized name
 *
 * IMPORTANT:
 *   - Old collection is READ ONLY
 *   - Existing employers/dailyworks are dropped and recreated
 *   - Same normalized name = ONE Employer
 *   - Every old record = ONE DailyWork
 *   - If ANY record of a worker is active, Employer is ACTIVE
 *   - Deleted DailyWork history is preserved
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { calculateOvertimeAmount } from "../utils/salary-helper-fun.js";
import { round2 } from "../utils/helperFun.js";

dotenv.config();

// ===============================================================
// COLLECTIONS
// ===============================================================

const OLD_COLLECTION = "employers1232344354554";

const NEW_EMPLOYERS_COLLECTION = "employers";

const NEW_DAILYWORK_COLLECTION = "dailyworks";

// ===============================================================
// NORMALIZE NAME
// ===============================================================

const normalizeName = (name) => {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};

// ===============================================================
// HELPERS
// ===============================================================

const cleanString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const toNumber = (value, defaultValue = 0) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return defaultValue;
  }

  return number;
};

const toDate = (value) => {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
};

// ===============================================================
// CHECK ACTIVE RECORD
// ===============================================================

const isActiveRecord = (doc) => {
  return (
    doc.deleted_at === null ||
    doc.deleted_at === undefined
  );
};

// ===============================================================
// MAIN
// ===============================================================

const run = async () => {
  try {
    console.log("==============================================");
    console.log("   SAFE EMPLOYER / DAILY WORK MIGRATION");
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

    const db = mongoose.connection.db;

    console.log("\nMongoDB connected.");

    // ===========================================================
    // CHECK OLD COLLECTION
    // ===========================================================

    const oldExists = await db
      .listCollections({
        name: OLD_COLLECTION,
      })
      .hasNext();

    if (!oldExists) {
      throw new Error(
        `"${OLD_COLLECTION}" collection does not exist.`,
      );
    }

    const oldCount = await db
      .collection(OLD_COLLECTION)
      .countDocuments();

    console.log(`\nOld records: ${oldCount}`);

    if (oldCount === 0) {
      throw new Error(
        `"${OLD_COLLECTION}" is empty. Migration stopped.`,
      );
    }

    // ===========================================================
    // DROP NEW COLLECTIONS
    // ===========================================================

    console.log("\nPreparing migration collections...");

    const employersExists = await db
      .listCollections({
        name: NEW_EMPLOYERS_COLLECTION,
      })
      .hasNext();

    if (employersExists) {
      await db
        .collection(NEW_EMPLOYERS_COLLECTION)
        .drop();

      console.log(
        `Dropped "${NEW_EMPLOYERS_COLLECTION}".`,
      );
    }

    const dailyWorksExists = await db
      .listCollections({
        name: NEW_DAILYWORK_COLLECTION,
      })
      .hasNext();

    if (dailyWorksExists) {
      await db
        .collection(NEW_DAILYWORK_COLLECTION)
        .drop();

      console.log(
        `Dropped "${NEW_DAILYWORK_COLLECTION}".`,
      );
    }

    // ===========================================================
    // READ OLD DATA
    // ===========================================================

    console.log("\nReading old data...");

    const oldDocs = await db
      .collection(OLD_COLLECTION)
      .find({})
      .sort({
        entryDate: 1,
        created_at: 1,
      })
      .toArray();

    console.log(
      `Loaded ${oldDocs.length} records.`,
    );

    // ===========================================================
    // GROUP BY NORMALIZED NAME
    // ===========================================================

    const groups = new Map();

    const invalidRecords = [];

    for (const doc of oldDocs) {
      const originalName = cleanString(doc.name);

      const normalizedName =
        normalizeName(originalName);

      if (!normalizedName) {
        invalidRecords.push(doc._id);
        continue;
      }

      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }

      groups
        .get(normalizedName)
        .push(doc);
    }

    console.log(
      `\nUnique workers: ${groups.size}`,
    );

    // ===========================================================
    // STOP IF EMPTY NAMES FOUND
    // ===========================================================

    if (invalidRecords.length > 0) {
      console.log(
        `\nWARNING: ${invalidRecords.length} records have empty names.`,
      );

      console.log(
        "Migration stopped for safety.",
      );

      console.log(
        "Invalid IDs:",
        invalidRecords
          .map((id) => id.toString())
          .join(", "),
      );

      throw new Error(
        "Empty worker names found.",
      );
    }

    // ===========================================================
    // CREATE EMPLOYERS
    // ===========================================================

    const employerDocuments = [];

    const employerIdMap = new Map();

    for (const [
      normalizedName,
      docs,
    ] of groups.entries()) {
      /*
       * IMPORTANT LOGIC:
       *
       * If ANY record is active:
       *   Employer = active
       *
       * Active record:
       *   deleted_at = null / undefined
       *
       * If no active record exists:
       *   Employer = inactive
       */

      const activeDocs = docs.filter(
        isActiveRecord,
      );

      const hasActiveRecord =
        activeDocs.length > 0;

      /*
       * For Employer data:
       *
       * If active record exists:
       *   Use latest ACTIVE record
       *
       * Otherwise:
       *   Use latest record
       */

      const sourceDocs = hasActiveRecord
        ? activeDocs
        : docs;

      const sourceDoc =
        sourceDocs[sourceDocs.length - 1];

      const displayName =
        cleanString(sourceDoc.name) ||
        cleanString(docs[0].name) ||
        normalizedName;

      // New MongoDB Employer _id
      const employerId =
        new mongoose.Types.ObjectId();

      // Map normalized name -> Employer _id
      employerIdMap.set(
        normalizedName,
        employerId,
      );

      const employerDocument = {
        _id: employerId,

        // =====================================================
        // BASIC INFO
        // =====================================================

        name: displayName,

        // No workerId

        // =====================================================
        // DESIGNATION
        // =====================================================

        designation:
          sourceDoc.designation === "mazdoor" ||
          sourceDoc.designation === "qarigar"
            ? sourceDoc.designation
            : "mazdoor",

        // =====================================================
        // SALARY
        // =====================================================

        salary: toNumber(
          sourceDoc.salary,
          0,
        ),

        // =====================================================
        // FIRST ENTRY DATE
        // =====================================================

        entryDate: toDate(
          docs[0].entryDate ||
            docs[0].created_at ||
            new Date(),
        ),

        // =====================================================
        // DESCRIPTION
        // =====================================================

        description:
          cleanString(
            sourceDoc.description,
          ),

        // =====================================================
        // STATUS
        // =====================================================

        status: hasActiveRecord
          ? "active"
          : "inactive",

        // =====================================================
        // DELETED AT
        // =====================================================

        deleted_at: hasActiveRecord
          ? null
          : toDate(
              sourceDoc.deleted_at,
            ),

        // =====================================================
        // CREATED AT
        // =====================================================

        created_at: toDate(
          docs[0].created_at ||
            docs[0].entryDate ||
            new Date(),
        ),

        // =====================================================
        // UPDATED AT
        // =====================================================

        updated_at: toDate(
          sourceDoc.updated_at ||
            sourceDoc.entryDate ||
            new Date(),
        ),
      };

      employerDocuments.push(
        employerDocument,
      );

      console.log(
        `Employer: ${displayName} | ` +
        `Records: ${docs.length} | ` +
        `Active Records: ${activeDocs.length} | ` +
        `Status: ${employerDocument.status}`,
      );
    }

    // ===========================================================
    // INSERT EMPLOYERS
    // ===========================================================

    if (employerDocuments.length > 0) {
      await db
        .collection(
          NEW_EMPLOYERS_COLLECTION,
        )
        .insertMany(
          employerDocuments,
        );
    }

    console.log(
      `\nCreated ${employerDocuments.length} Employers.`,
    );

    // ===========================================================
    // CREATE DAILY WORK
    // ===========================================================

    const dailyWorkDocuments = [];

    for (const doc of oldDocs) {
      const normalizedName =
        normalizeName(doc.name);

      const employerId =
        employerIdMap.get(
          normalizedName,
        );

      if (!employerId) {
        throw new Error(
          `Employer not found for: "${doc.name}"`,
        );
      }

      const dailyWorkDocument = {
        _id:
          new mongoose.Types.ObjectId(),

        // =====================================================
        // EMPLOYER LINK
        // =====================================================

        employerId,

        // =====================================================
        // DATE
        // =====================================================

        entryDate: toDate(
          doc.entryDate ||
            doc.created_at ||
            new Date(),
        ),

        // =====================================================
        // SITE
        // =====================================================

        currentSite:
          cleanString(
            doc.currentSite,
          ),

        // =====================================================
        // ATTENDANCE
        // =====================================================

        attendance:
          doc.attendance === "absent" ||
          doc.attendence === "absent"
            ? "absent"
            : "present",

        // =====================================================
        // WORK STATUS
        // =====================================================

        workStatus:
          [
            "pending",
            "inprogress",
            "completed",
          ].includes(
            doc.workStatus,
          )
            ? doc.workStatus
            : "pending",

        // =====================================================
        // WORK UNDER
        // =====================================================

        workUnder:
          [
            "owner",
            "partnerShip",
            "client",
          ].includes(
            doc.workUnder,
          )
            ? doc.workUnder
            : undefined,

        // =====================================================
        // DAILY SALARY
        // =====================================================

        salary: toNumber(
          doc.salary,
          0,
        ),

        // =====================================================
        // OVERTIME
        // =====================================================

        overtimeHours: toNumber(
          doc.overTime,
          0,
        ),

        // Calculate overtime amount from salary and hours
        overtimeAmount: calculateOvertimeAmount(
          toNumber(doc.salary, 0),
          toNumber(doc.overTime, 0)
        ),

        // =====================================================
        // ADVANCE
        // =====================================================
        //
        // OLD:
        //   advanced
        //
        // NEW:
        //   advanceAmount
        //
        // =====================================================

        advanceAmount: toNumber(
          doc.advanced,
          0,
        ),

        // =====================================================
        // DESCRIPTION
        // =====================================================

        description:
          cleanString(
            doc.description,
          ),

        // =====================================================
        // DELETED AT
        // =====================================================

        deleted_at:
          doc.deleted_at
            ? toDate(
                doc.deleted_at,
              )
            : null,

        // =====================================================
        // CREATED AT
        // =====================================================

        created_at: toDate(
          doc.created_at ||
            doc.entryDate ||
            new Date(),
        ),

        // =====================================================
        // UPDATED AT
        // =====================================================

        updated_at: toDate(
          doc.updated_at ||
            doc.entryDate ||
            new Date(),
        ),
      };

      dailyWorkDocuments.push(
        dailyWorkDocument,
      );
    }

    // ===========================================================
    // INSERT DAILY WORK
    // ===========================================================

    if (
      dailyWorkDocuments.length > 0
    ) {
      await db
        .collection(
          NEW_DAILYWORK_COLLECTION,
        )
        .insertMany(
          dailyWorkDocuments,
        );
    }

    console.log(
      `Created ${dailyWorkDocuments.length} DailyWorks.`,
    );

    // ===========================================================
    // INDEXES
    // ===========================================================

    console.log(
      "\nCreating indexes...",
    );

    await db
      .collection(
        NEW_EMPLOYERS_COLLECTION,
      )
      .createIndex({
        name: 1,
        status: 1,
      });

    await db
      .collection(
        NEW_EMPLOYERS_COLLECTION,
      )
      .createIndex({
        status: 1,
      });

    await db
      .collection(
        NEW_EMPLOYERS_COLLECTION,
      )
      .createIndex({
        deleted_at: 1,
      });

    await db
      .collection(
        NEW_DAILYWORK_COLLECTION,
      )
      .createIndex({
        employerId: 1,
        entryDate: -1,
      });

    await db
      .collection(
        NEW_DAILYWORK_COLLECTION,
      )
      .createIndex({
        entryDate: -1,
      });

    // ===========================================================
    // VERIFY
    // ===========================================================

    const newEmployerCount =
      await db
        .collection(
          NEW_EMPLOYERS_COLLECTION,
        )
        .countDocuments();

    const newDailyWorkCount =
      await db
        .collection(
          NEW_DAILYWORK_COLLECTION,
        )
        .countDocuments();

    // ===========================================================
    // ACTIVE / INACTIVE COUNT
    // ===========================================================

    const activeEmployerCount =
      await db
        .collection(
          NEW_EMPLOYERS_COLLECTION,
        )
        .countDocuments({
          deleted_at: null,
        });

    const inactiveEmployerCount =
      await db
        .collection(
          NEW_EMPLOYERS_COLLECTION,
        )
        .countDocuments({
          deleted_at: {
            $ne: null,
          },
        });

    // ===========================================================
    // FINAL REPORT
    // ===========================================================

    console.log(
      "\n==============================================",
    );

    console.log(
      "             MIGRATION COMPLETE",
    );

    console.log(
      "==============================================",
    );

    console.log(
      `Old records:       ${oldDocs.length}`,
    );

    console.log(
      `Unique workers:    ${groups.size}`,
    );

    console.log(
      `New Employers:     ${newEmployerCount}`,
    );

    console.log(
      `Active Employers:  ${activeEmployerCount}`,
    );

    console.log(
      `Inactive Employers:${inactiveEmployerCount}`,
    );

    console.log(
      `New DailyWorks:    ${newDailyWorkCount}`,
    );

    console.log(
      "\n✓ Worker identity = normalized name",
    );

    console.log(
      "✓ workerId is NOT used",
    );

    console.log(
      "✓ Same name = ONE Employer",
    );

    console.log(
      "✓ ANY active record = ACTIVE Employer",
    );

    console.log(
      "✓ Every old record = ONE DailyWork",
    );

    console.log(
      "✓ Deleted DailyWork history preserved",
    );

    console.log(
      "✓ advanced -> advanceAmount",
    );

    console.log(
      "✓ attendance/attendence handled",
    );

    console.log(
      `✓ Old collection "${OLD_COLLECTION}" was NOT modified`,
    );

    if (
      newDailyWorkCount !==
      oldDocs.length
    ) {
      console.log(
        "\n⚠ WARNING: DailyWork count mismatch!",
      );
    } else {
      console.log(
        "\n✓ DailyWork count matches old records",
      );
    }

    console.log(
      "\n==============================================",
    );
  } catch (error) {
    console.error(
      "\n==============================================",
    );

    console.error(
      "MIGRATION FAILED",
    );

    console.error(
      "==============================================",
    );

    console.error(
      error.message,
    );

    console.error(
      "==============================================",
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();