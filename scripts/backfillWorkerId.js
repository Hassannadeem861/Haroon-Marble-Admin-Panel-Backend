import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/employer-model.js";

const DRY_RUN = process.argv.includes("--dry-run");
console.log("DRY_RUN: ", DRY_RUN)
const generateWorkerId = (name) => {
  const slug = name.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const entries = await User.find({ workerId: { $exists: false } });
  const nameToWorkerId = new Map();

  console.log(`Found ${entries.length} entries without workerId.`);
  console.log(DRY_RUN ? "DRY RUN MODE — nothing will be saved.\n" : "LIVE MODE — changes will be saved.\n");

  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase();
    if (!nameToWorkerId.has(key)) {
      nameToWorkerId.set(key, generateWorkerId(entry.name));
    }
    const assignedId = nameToWorkerId.get(key);

    console.log(`${entry.name} (${entry._id}) -> ${assignedId}`);

    if (!DRY_RUN) {
      entry.workerId = assignedId;
      await entry.save();
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY RUN] Would backfill" : "Backfilled"} ${entries.length} entries -> ${nameToWorkerId.size} unique workers.`);
  process.exit(0);
};

run();