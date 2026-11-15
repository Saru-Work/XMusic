const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const { UPLOADS_ROOT } = require("./upload");
const music_router = require("./routes/music.routes");
const artist_router = require("./routes/artist.routes");
const auth_router = require("./routes/auth.routes");
const album_router = require("./routes/album.routes");
const playlist_router = require("./routes/playlist.routes");

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();
app.use(
  cors({
    origin: CLIENT_URL,
    allowedHeaders: ["Content-type", "Authorization"],
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_ROOT));
app.use("/", music_router);
app.use("/", artist_router);
app.use("/", auth_router);
app.use("/album", album_router);
app.use("/playlist", playlist_router);

// Upload / unexpected errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith("Invalid file type")) {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "Server Error!" });
});

async function start() {
  await connectDB();
  app.listen(PORT, (err) => {
    if (err) {
      console.error(`Could not start server on port ${PORT}: ${err.message}`);
      process.exit(1);
    }
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

start();
