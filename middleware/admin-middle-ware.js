import jwt from "jsonwebtoken";
import adminModel from "../models/admin-auth-model.js";
import dotenv from "dotenv";

dotenv.config();

const authMiddleware = async (req, res, next) => {
  
  const token = req.cookies?.token
  console.log("token :", token)
 
  if (!token) {
    return res.status(200).json({ message: "Token not provided" });
  }

  try {

    const verifyToken = jwt.verify(token, process.env.JWT_SECRET);

  //  const admin = await adminModel.findById(verifyToken.adminId);
   
  //  if (!admin) {
  //     return res.status(200).json({ message: "Admin not found" });
  //   }

    req.admin = verifyToken;
    
    next();
  } catch (error) {
    return res.status(500).json({ message: "Invalid token", error: error.message });

  }
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