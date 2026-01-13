import type { Song } from "../App";
const Player = ({ song }: { song: Song }) => {
  return (
    <div className="bg-gray-800">
      <h2 className="text-white">{song.name}</h2>
      <audio className="bg-black" controls autoPlay src={song.link}></audio>
    </div>
  );
};

export default Player;
