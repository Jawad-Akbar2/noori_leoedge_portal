// backend/api/cron/purge.js

import { purgeLeftEmployees } from "../../services/purgeService.js";

export default async function handler(req, res) {
  try {
    console.log("[CRON] purge triggered at", new Date().toISOString());

    const deleted = await purgeLeftEmployees();

    console.log("[CRON] deleted employees:", deleted);

    res.status(200).json({
      success: true,
      deleted
    });
  } catch (err) {
    console.error("[CRON] error:", err.message);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
}