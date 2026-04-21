// ─── schedulers/purgeLeftEmployees.js ────────────────────────────

import cron from "node-cron";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";

let isRunning = false; // prevent overlapping runs

export async function purgeLeftEmployees() {
  if (isRunning) {
    console.log("[purge:leftEmployees] Skipped (already running)");
    return 0;
  }

  isRunning = true;

  try {
    // Ensure DB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("[purge:leftEmployees] DB not connected. Skipping...");
      return 0;
    }

    const now = new Date();

const result = await Employee.deleteMany({
  "leftBusiness.isLeft": true,
  "leftBusiness.scheduledDeletion": { $lte: now },
});

// ✅ ADD HERE
console.log(
  `[purge:leftEmployees] ${now.toISOString()} — checked, deleted ${result.deletedCount}`
);

    return result.deletedCount;
  } catch (err) {
    console.error("[purge:leftEmployees] Error:", err.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

// ── Schedule: every day at 02:00 (server timezone) ───────────────
cron.schedule(
  "0 2 * * *",
  async () => {
    console.log("[purge:leftEmployees] Running scheduled purge...");
    await purgeLeftEmployees();
  },
  {
    timezone: "Asia/Karachi", // ✅ IMPORTANT for Pakistan
  }
);

// cron.schedule(
//   "50 11 * * *", // ⬅️ 11:50 AM
//   async () => {
//     console.log("[purge:leftEmployees] Running scheduled purge...");
//     await purgeLeftEmployees();
//   },
//   {
//     timezone: "Asia/Karachi",
//   }
// );

console.log(
  "[purge:leftEmployees] Scheduler registered (02:00 Asia/Karachi)"
);