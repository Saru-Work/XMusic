import type { Song } from "../pages/HomePage";
const Player = ({ song }: { song: Song | undefined }) => {
  return (
    <div className="bg-gray-800">
      <h2 className="text-white">{song?.title}</h2>
      <audio className="bg-black" controls autoPlay src={song?.url}></audio>
    </div>
  );
};

export default Player;
