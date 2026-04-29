// models/Verification.js
import mongoose from 'mongoose';
import crypto   from 'crypto';

const verificationSchema = new mongoose.Schema(
  {
    _id:        { type: String, default: () => crypto.randomBytes(16).toString('hex') },
    identifier: { type: String, required: true, index: true },
    value:      { type: String, required: true },
    expiresAt:  { type: Date,   required: true, index: true },
  },
  {
    timestamps: true,
    _id:        false,
    versionKey: false,
  },
);

// ─── Existing TTL index ───────────────────────────────────────────────────────
// MongoDB's TTL monitor deletes documents once expiresAt passes.
// expireAfterSeconds: 0 means "delete at exactly expiresAt."
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── New compound index ───────────────────────────────────────────────────────
// findValid() always queries { identifier, value, expiresAt: { $gt: now } }.
// The two existing single-field indexes on identifier and expiresAt mean
// MongoDB picks one and filters the other in memory. A compound index on
// identifier + expiresAt resolves the email equality match AND the expiry
// range check in a single B-tree seek, then value is matched from the
// returned candidates (too high-cardinality to index, and value is a hash
// so there will only ever be one match per identifier anyway).
verificationSchema.index(
  { identifier: 1, expiresAt: 1 },
  { name: 'idx_identifier_expiresAt' },
);

// ─── Static helpers ───────────────────────────────────────────────────────────
verificationSchema.statics.createForEmail = async function (email, ttlMinutes = 15) {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashed     = crypto.createHash('sha256').update(plainToken).digest('hex');
  const expiresAt  = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await this.deleteMany({ identifier: email.toLowerCase() });
  await this.create({ identifier: email.toLowerCase(), value: hashed, expiresAt });

  return plainToken;
};

verificationSchema.statics.findValid = async function (email, plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');
  return this.findOne({
    identifier: email.toLowerCase(),
    value:      hashed,
    expiresAt:  { $gt: new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}) },
  });
};

const Verification = mongoose.model('Verification', verificationSchema);
export default Verification;