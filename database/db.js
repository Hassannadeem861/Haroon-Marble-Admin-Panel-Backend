import dotenv from "dotenv";
dotenv.config();
import dns from "dns/promises"
import mongoose from "mongoose";

dns.setServers([
  "1.1.1.1",
  // "8.8.8.8"
])

const mongodbURI = process.env.MONGODB_URI;
const connectDB = async () => {
  try {
    await mongoose.connect(mongodbURI);
    console.log("Database is connected");
  } catch (error) {
    console.error("Mongoose connection error:", error.message);
    process.exit(1);
  }
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