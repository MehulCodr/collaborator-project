import fs from "fs";
import path from "path";
import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const uploadDir = path.resolve("uploads/tasks");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBaseName = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeBaseName}${ext}`;

    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new ApiError(400, "Invalid file type"));
    return;
  }

  cb(null, true);
};

export const uploadTaskAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});