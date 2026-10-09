import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./database/db.js";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const app = express();

connectDB().catch(() => {}); // error db.js log karta hai; agli request dobara try karti hai

// Step 1: CORS setup fix
const allowedOrigins = [
  process.env.FRONTEND_LIVE_URL,
  // process.env.FRONTEND_LOCAL_URL,
  // "https://haroon-marble-admin-panel.vercel.app",
  // "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Agar koi origin nahi (Postman ya server request), to allow karo
      if (!origin) return callback(null, true);

      // Agar origin allowed list me hai to allow karo
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());

// Serve static files (for accessing uploaded files)
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Hello world" });
});

// Vercel cold start: har API request DB connect hone tak rukti hai. Iske baghair pehli request
// Mongoose ke 10s buffer timeout par 500 deti thi aur doosri chal jati thi.
app.use("/api/v1", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    return res.status(503).json({ success: false, message: "Database se connect nahi ho saka. Dobara koshish karein." });
  }
});

import AdminAuthRouter from "./routes/admin-auth-route.js";
import employerRouter from "./routes/employer-route.js";
import factoryWorkRoutes from "./routes/factory-work-routes.js";
import DailyWorkRoutes from "./routes/daliy-work-routes.js";
import SiteRoutes from "./routes/site-route.js";
import SiteMaterialRoutes from "./routes/site-material-route.js";
import SiteExpenseRoutes from "./routes/site-expence-route.js";
import dashboardRoutes from "./routes/dashboard-routes.js";
import workOrderRoutes from "./routes/work-order-route.js";
import sampleRoundRoutes from "./routes/sample-round-route.js";
import siteIssueRoutes from "./routes/site-issue-route.js";
import workDayRoutes from "./routes/work-day-route.js";
import multer from "multer";


app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", AdminAuthRouter);
app.use("/api/v1", employerRouter);
app.use("/api/v1", workOrderRoutes);
app.use("/api/v1", sampleRoundRoutes);
app.use("/api/v1", siteIssueRoutes);
app.use("/api/v1", workDayRoutes);
app.use("/api/v1", DailyWorkRoutes);
app.use("/api/v1/factory-work", factoryWorkRoutes);
app.use("/api/v1/site", SiteRoutes);
app.use("/api/v1/site-material", SiteMaterialRoutes);
app.use("/api/v1/site-expense", SiteExpenseRoutes);

const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "Har photo zyada se zyada 5 MB ki ho sakti hai.",
  LIMIT_FILE_COUNT: "Zyada se zyada 5 photos lag sakti hain.",
  LIMIT_UNEXPECTED_FILE: "Zyada se zyada 5 photos, field name \"images\" hona chahiye.",
};

// Global error handler — multer, galat JSON aur baqi unexpected errors ka JSON response.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: MULTER_ERROR_MESSAGES[err.code] || "Photo upload mein masla aaya." });
  }
  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body." });
  }
  console.error("Unhandled error:", err);
  return res.status(err.status || 500).json({ success: false, message: "Server error. Please try again." });
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

export default app;
