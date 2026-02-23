const streamifier = require("streamifier");
const Song = require("../models/Song");
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  secure: true,
});

async function get_song(req, res) {
  const songs = await Song.find({});
  return res.json({ songs });
}

async function get_songs(req, res) {
  try {
    const songs = await Song.find({});
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
}
async function upload_audio(req, res) {
  try {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "audios",
      },
      async (error, result) => {
        if (error) return res.status(500).json({ message: "Server Error!" });
        const song = await Song.create({
          title: req.body.name,
          url: result.secure_url,
        });
        res.json({ song });
      },
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
module.exports = upload_audio;

module.exports = { get_song, get_songs, upload_audio };
