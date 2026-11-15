import { Music } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, primaryButton } from "../components/States";

/**
 * /playing. While a song is playing, the layout's "now playing" section takes
 * over the page area (see AppLayout), so this only shows when nothing is.
 */
const NowPlayingPage = () => {
  return (
    <div className="min-h-full p-5">
      <EmptyState icon={Music} title="Nothing is playing">
        Pick a song and it will show up here.
        <Link to="/tracks" className={primaryButton}>
          Browse tracks
        </Link>
      </EmptyState>
    </div>
  );
};

export default NowPlayingPage;
