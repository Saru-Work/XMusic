import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, primaryButton } from "../components/States";

const NotFoundPage = () => {
  return (
    <div className="min-h-full p-5">
      <EmptyState icon={Compass} title="Page not found">
        The page you're looking for doesn't exist or has moved.
        <Link to="/" className={primaryButton}>
          Go home
        </Link>
      </EmptyState>
    </div>
  );
};

export default NotFoundPage;
