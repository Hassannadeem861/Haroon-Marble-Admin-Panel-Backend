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

connectDB();

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



app.use("/api/v1", dashboardRoutes);
app.use("/api/v1", AdminAuthRouter);
app.use("/api/v1", employerRouter);
app.use("/api/v1", workOrderRoutes);
app.use("/api/v1", sampleRoundRoutes);
app.use("/api/v1", DailyWorkRoutes);
app.use("/api/v1/factory-work", factoryWorkRoutes);
app.use("/api/v1/site", SiteRoutes);
app.use("/api/v1/site-material", SiteMaterialRoutes);
app.use("/api/v1/site-expense", SiteExpenseRoutes);

// test route
app.get("/", (req, res) => {
  res.json({ message: "Backend running on Vercel 🚀" });
});

const PORT = process.env.PORT;
// console.log("PORT :", PORT)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

export default app;
