import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Check, CircleAlert, Eye, EyeOff, Lock, Mail, Music } from "lucide-react";
import type { AppDispatch } from "../store/store";
import { storeUser, type UserState } from "../reducers/userReducer";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Spinner } from "./States";
import GoogleButton from "./GoogleButton";
import AuthShowcase from "./AuthShowcase";

const MIN_PASSWORD = 6;

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to pick up right where you left off.",
    submit: "Log in",
    busy: "Logging in…",
    endpoint: "/login",
    switchText: "New to XMusic?",
    switchLink: "Create an account",
    switchTo: "/register",
  },
  register: {
    title: "Create your account",
    subtitle: "Save the songs you love, build playlists and play them anywhere.",
    submit: "Create account",
    busy: "Creating account…",
    endpoint: "/register",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchTo: "/login",
  },
};

const inputClass =
  "h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-10 text-sm text-white placeholder:text-gray-500 transition-colors hover:border-white/20 focus:border-white/40 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/15";

/** A labelled input with an icon on the left and an optional control on the right */
const Field = ({
  id,
  label,
  icon: Icon,
  trailing,
  hint,
  ...input
}: {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  trailing?: ReactNode;
  hint?: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-gray-200" htmlFor={id}>
      {label}
    </label>
    <div className="relative">
      <Icon
        size={16}
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-500"
      />
      <input id={id} name={id} className={cn(inputClass, trailing && "pr-11")} {...input} />
      {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
    </div>
    {hint}
  </div>
);

const AuthForm = ({ mode }: { mode: "login" | "register" }) => {
  const text = copy[mode];
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const longEnough = password.length >= MIN_PASSWORD;

  // Already signed in? Go straight to the app.
  useEffect(() => {
    api<{ authenticated: boolean }>("/checkAuth")
      .then((data) => {
        if (data.authenticated) navigate("/", { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  async function signIn(endpoint: string, json: unknown) {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: UserState }>(endpoint, { method: "POST", json });
      dispatch(storeUser(data.user));
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  // Google signs in, links or creates the account; the server answers like /login
  const handleGoogle = (credential: string) => signIn("/login/google", { credential });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() && !password) return setError("Enter your email and password.");
    if (!email.trim()) return setError("Enter your email.");
    if (!password) return setError("Enter your password.");
    if (mode === "register" && !longEnough) {
      return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    }
    signIn(text.endpoint, { email: email.trim(), password });
  }

  return (
    <div className="grid min-h-dvh w-full bg-black p-3 text-white lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-3">
      <AuthShowcase />

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Link to="/" className="flex w-fit items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-full bg-white text-black">
              <Music size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight">XMusic</span>
          </Link>

          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{text.title}</h1>
            <p className="text-sm text-gray-400">{text.subtitle}</p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
            <GoogleButton mode={mode} onCredential={handleGoogle} />

            <Field
              id="email"
              label="Email"
              icon={Mail}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Field
              id="password"
              label="Password"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "login" ? "Your password" : `At least ${MIN_PASSWORD} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((show) => !show)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="flex size-9 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              hint={
                mode === "register" && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors",
                      longEnough ? "text-emerald-400" : "text-gray-500",
                    )}
                  >
                    <Check size={13} className={longEnough ? "opacity-100" : "opacity-40"} />
                    At least {MIN_PASSWORD} characters
                  </p>
                )
              }
            />

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              disabled={submitting}
              className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner size={14} />}
              {submitting ? text.busy : text.submit}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400">
            {text.switchText}{" "}
            <Link className="font-medium text-white underline-offset-4 hover:underline" to={text.switchTo}>
              {text.switchLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthForm;
