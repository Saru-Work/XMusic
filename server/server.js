const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
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
const youtube_router = require("./routes/youtube.routes");
const like_router = require("./routes/like.routes");
const suggestion_router = require("./routes/suggestion.routes");
const remote_router = require("./routes/remote.routes");
const { attachHub } = require("./realtime/hub");
const { createMcpRouter } = require("./mcp");

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
app.use("/youtube", youtube_router);
app.use("/likes", like_router);
app.use("/suggestions", suggestion_router);
app.use("/remote", remote_router);
app.use("/mcp", createMcpRouter());

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
  // One HTTP server for the REST API and the remote-control socket
  const server = http.createServer(app);
  attachHub(server, { clientUrl: CLIENT_URL });
  server.on("error", (err) => {
    console.error(`Could not start server on port ${PORT}: ${err.message}`);
    process.exit(1);
  });
  server.listen(PORT, () => {
    console.log(`Server is listening on http://localhost:${PORT}`);
  });
}

start();
