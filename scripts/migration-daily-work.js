/**
 * FRESH MIGRATION
 * ---------------------------------------------------------------
 * OLD:
 *   employers_old_backup
 *
 * NEW:
 *   employers
 *   dailyworks
 *
 * IMPORTANT:
 * - Worker identity is based ONLY on normalized name.
 * - generateWorkerId() is NOT used.
 * - Old workerId is completely ignored.
 * - employers_old_backup is READ ONLY.
 *
 * Example:
 *   "Zahid"
 *   " Zahid "
 *   "ZAHID"
 *   "zahid  "
 *
 * all become:
 *   workerId = "zahid"
 *
 * One normalized name = ONE Employer document.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ---------------------------------------------------------------
// COLLECTION NAMES
// ---------------------------------------------------------------

const OLD_COLLECTION = "employers1232344354554";
const NEW_EMPLOYERS_COLLECTION = "employers";
const NEW_DAILYWORK_COLLECTION = "dailyworks";

// ---------------------------------------------------------------
// NORMALIZE NAME
// ---------------------------------------------------------------

const normalizeName = (name) => {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
};

// ---------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------

const toDate = (value) => {
  if (!value) return new Date();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
};

const toNumber = (value, defaultValue = 0) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return defaultValue;
  }

  return number;
};

const cleanString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------

const run = async () => {
  try {
    console.log("==============================================");
    console.log("   FRESH EMPLOYER / DAILY WORK MIGRATION");
    console.log("==============================================");

    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    // -----------------------------------------------------------
    // CONNECT
    // -----------------------------------------------------------

    await mongoose.connect(process.env.MONGODB_URI);

    const db = mongoose.connection.db;

    console.log("\nMongoDB connected.");

    // -----------------------------------------------------------
    // CHECK OLD BACKUP
    // -----------------------------------------------------------

    const oldExists = await db
      .listCollections({ name: OLD_COLLECTION })
      .hasNext();

    if (!oldExists) {
      throw new Error(
        `"${OLD_COLLECTION}" collection does not exist. Migration stopped.`,
      );
    }

    const oldCount = await db
      .collection(OLD_COLLECTION)
      .countDocuments();

    console.log(`\nOld backup records: ${oldCount}`);

    if (oldCount === 0) {
      throw new Error(
        `"${OLD_COLLECTION}" is empty. Migration stopped for safety.`,
      );
    }

    // -----------------------------------------------------------
    // DROP NEW COLLECTIONS
    // -----------------------------------------------------------

    console.log("\nPreparing new collections...");

    const employersExists = await db
      .listCollections({ name: NEW_EMPLOYERS_COLLECTION })
      .hasNext();

    if (employersExists) {
      await db.collection(NEW_EMPLOYERS_COLLECTION).drop();
      console.log(`Dropped "${NEW_EMPLOYERS_COLLECTION}".`);
    }

    const dailyWorksExists = await db
      .listCollections({ name: NEW_DAILYWORK_COLLECTION })
      .hasNext();

    if (dailyWorksExists) {
      await db.collection(NEW_DAILYWORK_COLLECTION).drop();
      console.log(`Dropped "${NEW_DAILYWORK_COLLECTION}".`);
    }

    // -----------------------------------------------------------
    // READ OLD DATA
    // -----------------------------------------------------------

    console.log("\nReading old backup...");

    const oldDocs = await db
      .collection(OLD_COLLECTION)
      .find({})
      .sort({ entryDate: 1, created_at: 1 })
      .toArray();

    console.log(`Loaded ${oldDocs.length} old records.`);

    // -----------------------------------------------------------
    // GROUP BY NORMALIZED NAME
    // -----------------------------------------------------------

    const groups = new Map();

    const invalidRecords = [];

    for (const doc of oldDocs) {
      const originalName = cleanString(doc.name);
      const normalizedName = normalizeName(originalName);

      if (!normalizedName) {
        invalidRecords.push(doc._id);

        continue;
      }

      if (!groups.has(normalizedName)) {
        groups.set(normalizedName, []);
      }

      groups.get(normalizedName).push(doc);
    }

    console.log(`\nUnique workers by normalized name: ${groups.size}`);

    if (invalidRecords.length > 0) {
      console.log(
        `WARNING: ${invalidRecords.length} records have empty names.`,
      );

      console.log("Migration stopped. Fix those records first.");

      console.log(
        "Invalid IDs:",
        invalidRecords.map((id) => id.toString()).join(", "),
      );

      throw new Error("Records with empty worker names found.");
    }

    // -----------------------------------------------------------
    // CREATE EMPLOYERS
    // -----------------------------------------------------------

    const employerDocuments = [];
    const employerIdMap = new Map();

    for (const [normalizedName, docs] of groups.entries()) {
      /*
       * docs are already sorted by entryDate ASC.
       *
       * Latest record is used for the worker's current/master
       * profile values such as salary and designation.
       */

      const latestDoc = docs[docs.length - 1];

      const displayName =
        cleanString(latestDoc.name) ||
        cleanString(docs[0].name) ||
        normalizedName;

      const employerId = new mongoose.Types.ObjectId();

      employerIdMap.set(normalizedName, employerId);

      const employerDocument = {
        _id: employerId,

        // Original/display name
        name: displayName,

        // IMPORTANT:
        // Name-based worker ID.
        workerId: normalizedName,

        // Latest profile information
        designation:
          latestDoc.designation === "mazdoor" ||
          latestDoc.designation === "qarigar"
            ? latestDoc.designation
            : "mazdoor",

        salary: toNumber(latestDoc.salary, 0),

        entryDate: toDate(
          docs[0].entryDate ||
            docs[0].created_at ||
            new Date(),
        ),

        description: cleanString(latestDoc.description),

        status:
          latestDoc.deleted_at !== null &&
          latestDoc.deleted_at !== undefined
            ? "inactive"
            : "active",

        deleted_at: latestDoc.deleted_at
          ? toDate(latestDoc.deleted_at)
          : null,

        created_at: toDate(
          docs[0].created_at ||
            docs[0].entryDate ||
            new Date(),
        ),

        updated_at: toDate(
          latestDoc.updated_at ||
            latestDoc.entryDate ||
            new Date(),
        ),
      };

      employerDocuments.push(employerDocument);
    }

    // -----------------------------------------------------------
    // INSERT EMPLOYERS
    // -----------------------------------------------------------

    if (employerDocuments.length > 0) {
      await db
        .collection(NEW_EMPLOYERS_COLLECTION)
        .insertMany(employerDocuments);
    }

    console.log(
      `\nCreated ${employerDocuments.length} Employer records.`,
    );

    // -----------------------------------------------------------
    // CREATE DAILY WORK DOCUMENTS
    // -----------------------------------------------------------

    const dailyWorkDocuments = [];

    for (const doc of oldDocs) {
      const normalizedName = normalizeName(doc.name);

      const employerId = employerIdMap.get(normalizedName);

      if (!employerId) {
        throw new Error(
          `Employer not found for worker: "${doc.name}"`,
        );
      }

      const dailyWorkDocument = {
        _id: new mongoose.Types.ObjectId(),

        employerId,

        entryDate: toDate(
          doc.entryDate ||
            doc.created_at ||
            new Date(),
        ),

        currentSite: cleanString(doc.currentSite),

        attendance:
          doc.attendance === "absent"
            ? "absent"
            : "present",

        workStatus:
          ["pending", "inprogress", "completed"].includes(
            doc.workStatus,
          )
            ? doc.workStatus
            : "pending",

        workUnder:
          ["owner", "partnerShip", "client"].includes(
            doc.workUnder,
          )
            ? doc.workUnder
            : undefined,

        // Old daily salary is preserved.
        salary: toNumber(doc.salary, 0),

        // OLD FIELD:
        // overTime
        //
        // NEW FIELD:
        // overtimeHours
        overtimeHours: toNumber(doc.overTime, 0),

        // Old data doesn't contain overtimeAmount.
        overtimeAmount: 0,

        // OLD FIELD:
        // advance
        //
        // NEW FIELD:
        // advanceAmount
        advanceAmount: toNumber(doc.advance, 0),

        description: cleanString(doc.description),

        deleted_at: doc.deleted_at
          ? toDate(doc.deleted_at)
          : null,

        created_at: toDate(
          doc.created_at ||
            doc.entryDate ||
            new Date(),
        ),

        updated_at: toDate(
          doc.updated_at ||
            doc.entryDate ||
            new Date(),
        ),
      };

      dailyWorkDocuments.push(dailyWorkDocument);
    }

    // -----------------------------------------------------------
    // INSERT DAILY WORK
    // -----------------------------------------------------------

    if (dailyWorkDocuments.length > 0) {
      await db
        .collection(NEW_DAILYWORK_COLLECTION)
        .insertMany(dailyWorkDocuments);
    }

    console.log(
      `Created ${dailyWorkDocuments.length} DailyWork records.`,
    );

    // -----------------------------------------------------------
    // CREATE INDEXES
    // -----------------------------------------------------------

    console.log("\nCreating indexes...");

    await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .createIndex(
        { workerId: 1 },
        { unique: true },
      );

    await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .createIndex({
        name: 1,
        status: 1,
      });

    await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .createIndex({
        status: 1,
      });

    await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .createIndex({
        deleted_at: 1,
      });

    await db
      .collection(NEW_DAILYWORK_COLLECTION)
      .createIndex({
        employerId: 1,
        entryDate: -1,
      });

    await db
      .collection(NEW_DAILYWORK_COLLECTION)
      .createIndex({
        entryDate: -1,
      });

    // -----------------------------------------------------------
    // VERIFICATION
    // -----------------------------------------------------------

    const newEmployerCount = await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .countDocuments();

    const newDailyWorkCount = await db
      .collection(NEW_DAILYWORK_COLLECTION)
      .countDocuments();

    // -----------------------------------------------------------
    // VERIFY NAME-BASED WORKER IDS
    // -----------------------------------------------------------

    const invalidWorkerIds = await db
      .collection(NEW_EMPLOYERS_COLLECTION)
      .find({
        $expr: {
          $ne: [
            "$workerId",
            {
              $toLower: {
                $trim: {
                  input: "$name",
                },
              },
            },
          ],
        },
      })
      .project({
        name: 1,
        workerId: 1,
      })
      .toArray();

    // -----------------------------------------------------------
    // FINAL REPORT
    // -----------------------------------------------------------

    console.log("\n==============================================");
    console.log("             MIGRATION COMPLETE");
    console.log("==============================================");

    console.log(`Old records:       ${oldDocs.length}`);
    console.log(`Unique workers:    ${groups.size}`);
    console.log(`New Employers:     ${newEmployerCount}`);
    console.log(`New DailyWorks:    ${newDailyWorkCount}`);

    console.log(
      `Invalid workerIds: ${invalidWorkerIds.length}`,
    );

    if (invalidWorkerIds.length > 0) {
      console.log("\nWARNING: Some workerIds don't match normalized names.");

      for (const worker of invalidWorkerIds) {
        console.log(
          `Name="${worker.name}" | workerId="${worker.workerId}"`,
        );
      }
    }

    if (newDailyWorkCount !== oldDocs.length) {
      console.log(
        "\nWARNING: DailyWork count does NOT match old record count.",
      );
    } else {
      console.log(
        "\n✓ Every old record has been migrated to DailyWork.",
      );
    }

    console.log(
      "\n✓ employers_old_backup was NOT modified.",
    );

    console.log(
      "✓ generateWorkerId() was NOT used.",
    );

    console.log(
      "✓ Worker identity is based on normalized name.",
    );

    console.log(
      "✓ One normalized name = one Employer.",
    );

    console.log("==============================================\n");
  } catch (error) {
    console.error("\n==============================================");
    console.error("MIGRATION FAILED");
    console.error("==============================================");
    console.error(error);
    console.error("==============================================\n");

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();