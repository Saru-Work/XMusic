const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UPLOADS_ROOT = path.join(__dirname, "uploads");
// Images go to uploads/images, audio files to uploads/audio
const FOLDERS = { image: "images", audio: "audio" };

for (const folder of Object.values(FOLDERS)) {
  fs.mkdirSync(path.join(UPLOADS_ROOT, folder), { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = FOLDERS[file.fieldname];
    if (!folder) return cb(new Error(`Unexpected upload field: ${file.fieldname}`));
    cb(null, path.join(UPLOADS_ROOT, folder));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const EXTENSIONS = {
  audio: [".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".webm", ".opus"],
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp"],
};

// Accept by MIME type, falling back to the extension (some clients send
// application/octet-stream for less common formats).
function fileFilter(req, file, cb) {
  const kind = file.fieldname === "audio" ? "audio" : "image";
  const ext = path.extname(file.originalname).toLowerCase();
  if (!file.mimetype.startsWith(`${kind}/`) && !EXTENSIONS[kind].includes(ext)) {
    return cb(new Error(`Invalid file type for "${file.fieldname}": ${file.mimetype}`));
  }
  cb(null, true);
}

exports.upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

exports.UPLOADS_ROOT = UPLOADS_ROOT;
