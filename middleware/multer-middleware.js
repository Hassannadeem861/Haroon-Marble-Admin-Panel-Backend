import multer from "multer";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { MAX_ISSUE_IMAGES } from "../models/site-issue-model.js";

dotenv.config(); // UPLOAD_TEMP_DIR import ke waqt hi parha jata hai

// Temporary folder — Cloudinary upload ke baad file yahan se delete ho jati hai.
// Default os.tmpdir() local machine aur Vercel (/tmp, sirf yahi writable hai) dono par chalta hai.
// Local machine par C: bhari ho to .env mein UPLOAD_TEMP_DIR (e.g. D:\temp\uploads) de sakte hain — Vercel par mat lagao.
export const TEMP_UPLOAD_DIR = process.env.UPLOAD_TEMP_DIR || path.join(os.tmpdir(), "haroon-marble-uploads");
fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

const IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const MAX_IMAGE_SIZE_MB = 5;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMP_UPLOAD_DIR),
  // Naam hamesha server banata hai — original filename kabhi use nahi hota (path traversal / collision).
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${IMAGE_EXTENSIONS[file.mimetype]}`),
});

const imageFileFilter = (req, file, cb) => {
  if (IMAGE_EXTENSIONS[file.mimetype]) return cb(null, true);
  const err = new Error("Sirf JPG, PNG ya WEBP photos allowed hain.");
  err.code = "INVALID_FILE_TYPE";
  return cb(err, false);
};

export const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024, files: MAX_ISSUE_IMAGES },
});

// Frontend FormData mein files exactly "images" naam se append kare.
export const uploadIssueImages = upload.array("images", MAX_ISSUE_IMAGES);

export const removeTempFiles = async (files = []) => {
  await Promise.all(
    files.map((file) => fs.promises.unlink(file.path).catch(() => {})),
  );
};
