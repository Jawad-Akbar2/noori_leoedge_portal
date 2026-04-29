// scripts/setShiftBreak.js
import "dotenv/config";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(MONGODB_URI, {
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
  });

  const result = await Employee.updateMany(
    { "shift.break": { $exists: false } },
    { $set: { "shift.break": 60 } }
  );

  console.log(`Updated ${result.modifiedCount} employees with shift.break = 60`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});