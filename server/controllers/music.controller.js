const musics = [
  {
    name: "Kannukkulla",
    link: "https://res.cloudinary.com/dffbsxhgc/video/upload/v1767590135/Kannukulla_izleno.mp3",
  },
  {
    name: "Nenjukkulle",
    link: "https://res.cloudinary.com/dffbsxhgc/video/upload/v1767591110/Nenjukkule_rmasfn.mp3",
  },
];
function get_song(req, res) {
  const { id } = req.params;
  console.log(id);
  res.send("Hi");
}

function get_songs(req, res) {
  res.send(musics);
}

module.exports = { get_song, get_songs };
