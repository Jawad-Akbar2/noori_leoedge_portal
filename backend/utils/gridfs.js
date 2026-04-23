// utils/gridfs.js
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";

let bucket = null;

export const initGridFS = () => {
  if (bucket) return; // already initialized — safe to call multiple times

  const db = mongoose.connection.db;
  if (!db) throw new Error("Cannot init GridFS: mongoose.connection.db is not ready");

  bucket = new GridFSBucket(db, {
    bucketName: "employeeFiles", // covers profilePicture + idCard front/back
    chunkSizeBytes: 255 * 1024,  // 255 KB chunks (GridFS default, explicit for clarity)
  });

  console.log("✓ GridFS bucket initialized (employeeFiles)");
};

export const getBucket = () => {
  if (!bucket) throw new Error("GridFS not initialized — call initGridFS() after mongoose.connect()");
  return bucket;
};

// Convenience: what type of file is this?
// Pass this as metadata.type when uploading so you can filter later.
export const FILE_TYPES = {
  PROFILE_PICTURE: "profilePicture",
  ID_CARD_FRONT:   "idCardFront",
  ID_CARD_BACK:    "idCardBack",
};