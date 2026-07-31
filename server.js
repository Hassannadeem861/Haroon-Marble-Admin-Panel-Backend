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
// console.log("__filename: ", __filename); // server.js

const __dirname = path.dirname(__filename);
// console.log("__dirname: ", __dirname); //Backend

const app = express();

connectDB();

// const corsOptions = {
//   origin: "https://vercel-hrms-client.vercel.app",
//   // origin: "http://localhost:5173",
//   methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
//   credentials: true,
// };

// Step 1: CORS setup fix
const allowedOrigins = [
  "https://haroon-marble-admin-panel.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("origin: ", origin)
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

// CORS preflight ke liye OPTIONS route handle karo
// app.options("*", cors());

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
// import salarySlipRouter from "./routes/salary-slip-route.js";

app.use("/api/v1", AdminAuthRouter);
app.use("/api/v1", employerRouter);
// app.use("/api/v1", salarySlipRouter);

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
