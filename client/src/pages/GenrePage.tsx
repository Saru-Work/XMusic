import { Music2Icon } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, PageTitle, secondaryButton } from "../components/States";

const GenrePage = () => {
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Genres" />
      <EmptyState icon={Music2Icon} title="Genres are coming soon">
        Browsing by genre isn't available yet.
        <Link to="/tracks" className={secondaryButton}>
          Browse all tracks
        </Link>
      </EmptyState>
    </div>
  );
};

export default GenrePage;
