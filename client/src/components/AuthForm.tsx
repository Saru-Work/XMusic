import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { Music } from "lucide-react";
import type { AppDispatch } from "../store/store";
import { storeUser, type UserState } from "../reducers/userReducer";
import { api, errorMessage } from "@/lib/api";
import { FormError, Spinner } from "./States";
import GoogleButton from "./GoogleButton";

const copy = {
  login: {
    title: "Log in to XMusic",
    submit: "Log in",
    endpoint: "/login",
    switchText: "New here?",
    switchLink: "Create an account",
    switchTo: "/register",
  },
  register: {
    title: "Create your account",
    submit: "Sign up",
    endpoint: "/register",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchTo: "/login",
  },
};

const input =
  "rounded-sm bg-white p-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-white/60";

const AuthForm = ({ mode }: { mode: "login" | "register" }) => {
  const text = copy[mode];
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Go straight to the app.
  useEffect(() => {
    api<{ authenticated: boolean }>("/checkAuth")
      .then((data) => {
        if (data.authenticated) navigate("/", { replace: true });
      })
      .catch(() => {});
  }, [navigate]);

  // Google signs in, links or creates the account; the server answers like /login
  async function handleGoogle(credential: string) {
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: UserState }>("/login/google", {
        method: "POST",
        json: { credential },
      });
      dispatch(storeUser(data.user));
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) {
      return setError("Enter your email and password.");
    }
    if (mode === "register" && password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await api<{ user: UserState }>(text.endpoint, {
        method: "POST",
        json: { email: email.trim(), password },
      });
      dispatch(storeUser(data.user));
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-linear-to-b from-[#121212] to-[#171717] p-4 text-white">
      <Link to="/" className="flex items-center gap-2">
        <Music />
        <span className="font-bold">XMusic</span>
      </Link>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex w-full max-w-sm flex-col gap-4 rounded-md bg-linear-to-b from-[rgba(255,255,255,0.1)] to-[rgba(255,255,255,0.05)] p-8"
      >
        <h1 className="text-center text-lg font-medium">{text.title}</h1>
        <GoogleButton mode={mode} onCredential={handleGoogle} />
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor="email">
            Email
          </label>
          <input
            className={input}
            type="email"
            id="email"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor="password">
            Password
          </label>
          <input
            className={input}
            type="password"
            id="password"
            name="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "register" && (
            <p className="text-xs text-gray-400">At least 6 characters.</p>
          )}
        </div>
        <FormError message={error} />
        <button
          disabled={submitting}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white py-2 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-60"
        >
          {submitting && <Spinner size={14} />}
          {text.submit}
        </button>
        <p className="text-center text-sm text-gray-300">
          {text.switchText}{" "}
          <Link className="text-white underline" to={text.switchTo}>
            {text.switchLink}
          </Link>
        </p>
      </form>
    </div>
  );
};

export default AuthForm;
