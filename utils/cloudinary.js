import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

// ES module imports pehle chalte hain, is liye yahan dotenv load karna zaroori hai
// warna cloudinary.config() ko env variables undefined milte.
dotenv.config();

const missingCloudinaryEnv = ["CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].filter(
  (key) => !process.env[key],
);
if (missingCloudinaryEnv.length > 0) {
  console.error(`Cloudinary env missing: ${missingCloudinaryEnv.join(", ")} — image upload kaam nahi karega.`);
}

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "haroon-marble/site-issues";

/**
 * Temp file ko Cloudinary par upload karta hai, phir temp file delete (kamyabi ho ya nakami).
 * Upload ke waqt hi (incoming transformation) image 1200px tak chhoti, WebP aur
 * auto-quality compress hoti hai — Cloudinary par sirf compressed version save hota hai,
 * original nahi. Har upload sirf 1 transformation count hoti hai.
 * Returns { url, publicId }. Error aaye to throw karta hai (caller cleanup decide kare).
 */
export const uploadFileOnCloudinary = async (localFilePath) => {
  try {
    const response = await cloudinary.uploader.upload(localFilePath, {
      folder: CLOUDINARY_FOLDER,
      resource_type: "image",
      format: "webp",
      transformation: [{ width: 1200, crop: "limit" }, { quality: "auto:good" }],
    });
    return { url: response.secure_url, publicId: response.public_id };
  } finally {
    await fs.promises.unlink(localFilePath).catch(() => {});
  }
};

export const deleteImg = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (error) {
    console.error("Cloudinary image delete failed:", publicId, error.message);
    return null;
  }
};
