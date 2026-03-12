// models/Verification.js
// Mirrors the SQL schema:
//   id, identifier, value, expiresAt, createdAt, updatedAt

import mongoose from 'mongoose';
import crypto from 'crypto';

const verificationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex')   // text PK
    },
    identifier: { type: String, required: true, index: true }, // email
    value:      { type: String, required: true },              // hashed token
    expiresAt:  { type: Date,   required: true, index: true }
  },
  {
    timestamps: true,           // createdAt + updatedAt
    _id: false,                 // we supply our own string _id
    versionKey: false
  }
);

// Auto-delete expired documents (TTL index on expiresAt)
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ── Static helpers ────────────────────────────────────────────────────────────

/** Create a new verification record and return the *plain* token. */
verificationSchema.statics.createForEmail = async function (email, ttlMinutes = 15) {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const hashed     = crypto.createHash('sha256').update(plainToken).digest('hex');
  const expiresAt  = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Remove any existing tokens for this email first
  await this.deleteMany({ identifier: email.toLowerCase() });

  await this.create({
    identifier: email.toLowerCase(),
    value:      hashed,
    expiresAt
  });

  return plainToken;  // send this in the email link
};

/** Verify a plain token and return the matching doc (or null). */
verificationSchema.statics.findValid = async function (email, plainToken) {
  const hashed = crypto.createHash('sha256').update(plainToken).digest('hex');
  return this.findOne({
    identifier: email.toLowerCase(),
    value:      hashed,
    expiresAt:  { $gt: new Date() }
  });
};

const Verification = mongoose.model('Verification', verificationSchema);
export default Verification;