const express = require("express");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const music_router = require("./routes/music.routes");
const artist_router = require("./routes/artist.routes");
const auth_router = require("./routes/auth.routes");
const cookieParser = require("cookie-parser");
const album_router = require("./routes/album.routes");
const playlist_router = require("./routes/playlist.routes");

const app = express();
cloudinary.config({
  cloud_name: "dffbsxhgc",
  api_key: "416158962298215",
  api_secret: "loybLbAIZztMi1w69-01gKsA19g",
});
app.use(
  cors({
    origin: "http://localhost:5173",
    allowedHeaders: ["Content-type", "Authorization"],
    credentials: true,
  }),
);
dotenv.config();
app.use(cookieParser());
app.use(express.json());
app.use("/", music_router);
app.use("/", artist_router);
app.use("/", auth_router);
app.use("/album", album_router);
app.use("/playlist", playlist_router);
app.listen(3000, async () => {
  console.log("Server is listening on port 3000");
  connectDB();
});

console.log("After listen");
