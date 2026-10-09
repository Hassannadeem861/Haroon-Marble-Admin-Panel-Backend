import dotenv from "dotenv";
dotenv.config();
import dns from "dns/promises"
import mongoose from "mongoose";

// Local ISP ka DNS Atlas ka SRV record resolve nahi karta, is liye sirf local par public DNS.
// Vercel par isay na lagao — wahan apna DNS tez hai, ye lookup ko slow kar deta hai (cold start 10s+).
if (!process.env.VERCEL) {
  dns.setServers([
    "1.1.1.1",
    "8.8.8.8"
  ])
}

const mongodbURI = process.env.MONGODB_URI;

// Serverless (Vercel) par ek hi connection promise share hota hai; fail ho to agli request dobara try karti hai.
let connectionPromise = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve();

  if (!connectionPromise) {
    const startedAt = Date.now();
    connectionPromise = mongoose
      .connect(mongodbURI, { serverSelectionTimeoutMS: 15000 })
      .then(() => {
        console.log(`Database is connected (${Date.now() - startedAt} ms)`);
      })
      .catch((error) => {
        connectionPromise = null;
        console.error("Mongoose connection error:", error.message);
        throw error;
      });
  }
  return connectionPromise;
};

mongoose.connection.on("connected", () => {
  console.log("Mongoose connected successfully");
});

mongoose.connection.on("disconnected", () => {
  console.log("Mongoose is disconnected");
});

mongoose.connection.on("error", (error) => {
  console.log("Mongoose error:", error.message);
});

process.on("SIGINT", () => {
  console.log("App is terminating");

  mongoose.connection.close(() => {
    console.log("Mongoose default connection closed");
    process.exit(0);
  });
});

export default connectDB;
