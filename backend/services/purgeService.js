// backend/services/purgeService.js

import mongoose from "mongoose";
import Employee from "../models/Employee.js";

const FALLBACK_RETENTION_DAYS = 30;

export async function purgeLeftEmployees() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const now = new Date();
  const fallbackCutoff = new Date(now);
  fallbackCutoff.setDate(fallbackCutoff.getDate() - FALLBACK_RETENTION_DAYS);

  const filter = {
    "leftBusiness.isLeft": true,
    $or: [
      { "leftBusiness.scheduledDeletion": { $lte: now } },
      {
        "leftBusiness.scheduledDeletion": { $in: [null, undefined] },
        "leftBusiness.leftDate": { $lte: fallbackCutoff },
      },
    ],
  };

  const result = await Employee.deleteMany(filter);

  return result.deletedCount;
}