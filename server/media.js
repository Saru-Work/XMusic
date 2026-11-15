// Helpers that replace what Cloudinary used to do for us:
// public URLs, audio duration and image color extraction.
const fs = require("fs/promises");
const path = require("path");
const { Vibrant } = require("node-vibrant/node");
const { UPLOADS_ROOT } = require("./upload");

function serverUrl() {
  return process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`;
}

// Public URL for a file that multer saved under uploads/
function fileUrl(file) {
  const relative = path.relative(UPLOADS_ROOT, file.path).split(path.sep).join("/");
  return `${serverUrl()}/uploads/${relative}`;
}

async function getAudioDuration(filePath) {
  const { parseFile } = await import("music-metadata");
  const metadata = await parseFile(filePath, { duration: true });
  return Math.round(metadata.format.duration || 0);
}

// Returns [{ hex, percentage }] sorted by dominance, always at least 3 entries
// (the client reads colors[0] and colors[2]).
async function getImageColors(filePath) {
  let colors = [];
  try {
    const palette = await Vibrant.from(filePath).getPalette();
    const swatches = Object.values(palette).filter(Boolean);
    const total = swatches.reduce((sum, s) => sum + s.population, 0) || 1;
    colors = swatches
      .sort((a, b) => b.population - a.population)
      .map((s) => ({ hex: s.hex, percentage: +((s.population / total) * 100).toFixed(2) }));
  } catch (err) {
    console.error("Color extraction failed:", err.message);
  }
  while (colors.length < 3) colors.push({ hex: "#333333", percentage: 0 });
  return colors;
}

// Remove an uploaded file when the request fails after multer saved it
async function removeFile(file) {
  if (!file) return;
  await fs.unlink(file.path).catch(() => {});
}

module.exports = { fileUrl, getAudioDuration, getImageColors, removeFile };
