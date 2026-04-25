// schedulers/purgeLeftEmployees.js
import cron from "node-cron";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";

// ── Constants ─────────────────────────────────────────────────────────────────
// How many days after leftDate an employee is permanently deleted if
// scheduledDeletion was never explicitly set by an admin.
const FALLBACK_RETENTION_DAYS = 30;

let isRunning = false; // prevent overlapping runs

// ─────────────────────────────────────────────────────────────────────────────
// purgeLeftEmployees
//
// Deletes employees who have left the business and whose grace period is over.
// Two conditions trigger deletion (either is sufficient):
//
//   1. Admin explicitly set scheduledDeletion and that date has passed.
//   2. No scheduledDeletion was ever set, but leftDate was 30+ days ago.
//      (Catches employees marked as left before the scheduledDeletion field
//       existed, or where admins forgot to set it.)
//
// Returns the number of documents deleted.
// ─────────────────────────────────────────────────────────────────────────────
export async function purgeLeftEmployees() {
  if (isRunning) {
    console.log("[purge:leftEmployees] Skipped — already running");
    return 0;
  }
  isRunning = true;

  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn("[purge:leftEmployees] DB not connected. Skipping...");
      return 0;
    }

    const now = new Date();

    // Cutoff for the fallback rule: leftDate must be older than this
    const fallbackCutoff = new Date(now);
    fallbackCutoff.setDate(fallbackCutoff.getDate() - FALLBACK_RETENTION_DAYS);

    // ── Build the deletion filter ─────────────────────────────────────────
    //
    // Only employees with isLeft: true are candidates.
    // Within that set we delete if EITHER condition holds:
    //
    //   Condition A — admin set a scheduledDeletion date and it has passed.
    //   Condition B — no scheduledDeletion was set (null/missing) but the
    //                 employee's leftDate is older than FALLBACK_RETENTION_DAYS.
    //
    const filter = {
      "leftBusiness.isLeft": true,
      $or: [
        // Condition A: explicit scheduled deletion date has passed
        {
          "leftBusiness.scheduledDeletion": { $lte: now },
        },
        // Condition B: no scheduled deletion set, but 30+ days since leftDate
        {
          "leftBusiness.scheduledDeletion": { $in: [null, undefined] },
          "leftBusiness.leftDate":          { $lte: fallbackCutoff },
        },
      ],
    };

    // ── Dry-run log before deleting ───────────────────────────────────────
    const candidates = await Employee.countDocuments(filter);
    if (candidates === 0) {
      console.log(
        `[purge:leftEmployees] ${now.toISOString()} — no employees due for deletion`,
      );
      return 0;
    }

    console.log(
      `[purge:leftEmployees] ${now.toISOString()} — found ${candidates} employee(s) to delete`,
    );

    const result = await Employee.deleteMany(filter);

    console.log(
      `[purge:leftEmployees] ${now.toISOString()} — deleted ${result.deletedCount} employee(s)`,
    );

    return result.deletedCount;
  } catch (err) {
    console.error("[purge:leftEmployees] Error:", err.message);
    return 0;
  } finally {
    isRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled job: runs every day at 02:00 Asia/Karachi
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule(
  "0 2 * * *",
  async () => {
    console.log("[purge:leftEmployees] Running scheduled purge...");
    await purgeLeftEmployees();
  },
  { timezone: "Asia/Karachi" },
);

console.log("[purge:leftEmployees] Scheduler registered (02:00 Asia/Karachi)");