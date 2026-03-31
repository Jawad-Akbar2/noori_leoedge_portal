// ─── schedulers/purgeLeftEmployees.js ────────────────────────────────────────
// Drop this file into your project and import it once in server.js / app.js.
//
//   import './schedulers/purgeLeftEmployees.js';
//
// Requires:  npm install node-cron

import cron from 'node-cron';
import Employee from '../models/Employee.js';

/**
 * Hard-delete every employee document whose 30-day post-departure retention
 * window has elapsed.
 *
 * Called automatically at 02:00 server-time every day.
 * Can also be called manually (e.g. in tests or one-off scripts).
 */
export async function purgeLeftEmployees() {
  const now = new Date();
  try {
    const result = await Employee.deleteMany({
      'leftBusiness.isLeft':            true,
      'leftBusiness.scheduledDeletion': { $lte: now },
    });
    if (result.deletedCount > 0) {
      console.log(
        `[purge:leftEmployees] ${new Date().toISOString()} — ` +
        `deleted ${result.deletedCount} record(s) past their 30-day retention window.`
      );
    }
    return result.deletedCount;
  } catch (err) {
    console.error('[purge:leftEmployees] Error during purge:', err.message);
    return 0;
  }
}

// ── Schedule: every day at 02:00 ─────────────────────────────────────────────
// Runs in the background once this module is imported.
cron.schedule('0 2 * * *', async () => {
  console.log('[purge:leftEmployees] Running scheduled purge…');
  await purgeLeftEmployees();
});

console.log('[purge:leftEmployees] Scheduler registered — will run daily at 02:00.');