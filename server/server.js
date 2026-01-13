const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const music_router = require("./routes/music.routes");
const app = express();

console.log("Before listen");
app.use(cors());
app.use(express.json());
app.use("/", music_router);
app.listen(3000, () => {
  console.log("Server is listening on port 5000");
  connectDB();
});

console.log("After listen");
