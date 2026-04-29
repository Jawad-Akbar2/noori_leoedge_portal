// scripts/fixStatus.js
import mongoose from "mongoose";
import AttendanceLog from "../models/AttendanceLog.js";
import dotenv     from 'dotenv';
dotenv.config();
const MONGODB_URI  = process.env.MONGODB_URI;

async function fixStatus() {
  await mongoose.connect(MONGODB_URI);

  const result = await AttendanceLog.updateMany(
    { status: "Absent" },
    { $set: { status: "OffDay" } }
  );

  console.log(`Updated ${result.modifiedCount} records`);

  await mongoose.disconnect();
}

fixStatus().catch(console.error);