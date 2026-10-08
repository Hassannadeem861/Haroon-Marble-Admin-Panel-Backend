import adminModel from "../models/admin-auth-model.js";
import dotenv from "dotenv";
import { verifyAccessToken } from "../utils/auth-token-service.js";

dotenv.config();

const JWT_ERRORS = ["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"];

// Sirf 15 minute wala access token (Bearer header) — expire hone par 401, frontend khud refresh karta hai.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error.status === 401 || JWT_ERRORS.includes(error.name)) {
      return res.status(401).json({ success: false, message: "Session expired. Please login again." });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }

  req.admin = payload;
  next();
};

const adminMiddleWare = async (req, res, next) => {
  try {

    const admin = await adminModel.findById(req?.admin?._id);

    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    if (admin?.role !== "admin") {
      return res.status(401).json({ message: "This user is not admin" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Error in admin middleware", error: error.message });
  }
};

export { authMiddleware, adminMiddleWare };