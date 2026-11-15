import { LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState, primaryButton } from "./States";

/** Shown on pages that need an account when nobody is logged in */
const LoginPrompt = ({ message }: { message: string }) => (
  <EmptyState icon={LogIn} title="You're not logged in">
    {message}
    <Link to="/login" className={primaryButton}>
      Log in
    </Link>
  </EmptyState>
);

export default LoginPrompt;
