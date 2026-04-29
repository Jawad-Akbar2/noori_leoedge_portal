// scripts/migrateProfilePictures.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const migrate = async () => {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("employees");

  // ── 1. Profile Picture ─────────────────────────────────────────────────────
  // Remove base64 data field + null out everything else
  const profileResult = await collection.updateMany(
    {}, // all employees, no filter — safe because $set/$unset are non-destructive
    {
      $unset: {
        "profilePicture.data":     "",   // remove base64 string entirely
        "profilePicture.mimeType": "",   // not in new schema
      },
      $set: {
        "profilePicture.fileId":    null,
        "profilePicture.fileName":  null,
        "profilePicture.uploadedAt": null,
      },
    }
  );
  console.log(`📸 profilePicture migrated: ${profileResult.modifiedCount} docs`);

  // ── 2. ID Card Front ───────────────────────────────────────────────────────
  const idCardFrontResult = await collection.updateMany(
    {},
    {
      $unset: { "idCard.front.url": "" },   // remove old url field
      $set: {
        "idCard.front.fileId":    null,
        "idCard.front.fileName":  null,
        "idCard.front.uploadedAt": null,
      },
    }
  );
  console.log(`🪪  idCard.front migrated:  ${idCardFrontResult.modifiedCount} docs`);

  // ── 3. ID Card Back ────────────────────────────────────────────────────────
  const idCardBackResult = await collection.updateMany(
    {},
    {
      $unset: { "idCard.back.url": "" },
      $set: {
        "idCard.back.fileId":    null,
        "idCard.back.fileName":  null,
        "idCard.back.uploadedAt": null,
      },
    }
  );
  console.log(`🪪  idCard.back migrated:   ${idCardBackResult.modifiedCount} docs`);

  // ── 4. Verification — spot check one doc ───────────────────────────────────
  const sample = await collection.findOne(
    {},
    { projection: { profilePicture: 1, idCard: 1, firstName: 1 } }
  );
  console.log("\n🔍 Sample doc after migration:");
  console.log(JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
  console.log("\n✅ Migration complete. Safe to update Employee schema now.");
};

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});