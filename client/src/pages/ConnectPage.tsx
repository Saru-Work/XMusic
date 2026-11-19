import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Check, CircleAlert, Music, ShieldCheck } from "lucide-react";
import type { AppDispatch } from "../store/store";
import { removeUser, storeUser, type UserState } from "../reducers/userReducer";
import { api, ApiError, errorMessage } from "@/lib/api";
import { Spinner } from "../components/States";

interface ConnectRequest {
  clientName: string;
  redirectHost: string;
  scopes: { id: string; description: string }[];
}

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; request: ConnectRequest; user: UserState };

/**
 * "Allow ChatGPT to use your XMusic account?" - the page an app's sign-in
 * popup lands on (via /oauth/authorize). Sends the listener to log in first
 * if needed, then back here.
 */
const ConnectPage = () => {
  const [params] = useSearchParams();
  const requestId = params.get("request") ?? "";
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const here = `/connect?request=${encodeURIComponent(requestId)}`;

  useEffect(() => {
    if (!requestId) {
      setView({ kind: "error", message: "This link is missing its request. Go back to the app and connect again." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const request = await api<ConnectRequest>(`/oauth/requests/${encodeURIComponent(requestId)}`);
        let user: UserState;
        try {
          user = await api<UserState>("/profile");
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            if (!cancelled) navigate(`/login?next=${encodeURIComponent(here)}`, { replace: true });
            return;
          }
          throw err;
        }
        if (cancelled) return;
        dispatch(storeUser(user));
        setView({ kind: "ready", request, user });
      } catch (err) {
        if (!cancelled) setView({ kind: "error", message: errorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, here, navigate, dispatch]);

  async function decide(allow: boolean) {
    setBusy(allow ? "allow" : "deny");
    setError(null);
    try {
      const { redirect } = await api<{ redirect: string }>(
        `/oauth/requests/${encodeURIComponent(requestId)}/decision`,
        { method: "POST", json: { allow } },
      );
      // Back to the app (ChatGPT), which finishes connecting
      window.location.assign(redirect);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function switchAccount() {
    try {
      await api("/logout", { method: "POST" });
    } catch {
      // Already logged out
    }
    dispatch(removeUser());
    navigate(`/login?next=${encodeURIComponent(here)}`, { replace: true });
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black p-4 text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(45% 40% at 20% 15%, rgba(124,58,237,0.25), transparent 70%)," +
            "radial-gradient(40% 35% at 85% 85%, rgba(236,72,153,0.18), transparent 70%)",
        }}
      />
      <main className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e12]/90 p-7 shadow-2xl backdrop-blur sm:p-8">
        {view.kind === "loading" && (
          <div className="flex justify-center py-16">
            <Spinner size={22} />
          </div>
        )}

        {view.kind === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <CircleAlert size={22} />
            </span>
            <h1 className="text-xl font-semibold">Couldn't connect</h1>
            <p className="text-sm text-gray-400">{view.message}</p>
            <Link to="/" className="text-sm font-medium text-white underline-offset-4 hover:underline">
              Go to XMusic
            </Link>
          </div>
        )}

        {view.kind === "ready" && (
          <div className="flex flex-col gap-6">
            {/* XMusic <-> app */}
            <div aria-hidden className="flex items-center justify-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-black">
                <Music size={22} />
              </span>
              <ArrowLeftRight size={18} className="text-gray-500" />
              <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 text-lg font-semibold">
                {view.request.clientName.trim().charAt(0).toUpperCase() || "?"}
              </span>
            </div>

            <header className="flex flex-col gap-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Allow {view.request.clientName} to use your XMusic?
              </h1>
              <p className="text-sm text-gray-400">
                {view.request.clientName} is asking to connect to your account.
              </p>
            </header>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {view.user.photoUrl ? (
                  <img src={view.user.photoUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-medium">
                    {(view.user.name || view.user.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 text-sm">
                  {view.user.name && <p className="truncate font-medium">{view.user.name}</p>}
                  <p className="truncate text-gray-400">{view.user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={switchAccount}
                disabled={busy !== null}
                className="shrink-0 cursor-pointer text-xs font-medium text-gray-300 underline-offset-4 hover:text-white hover:underline disabled:opacity-50"
              >
                Not you?
              </button>
            </div>

            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                It will be able to
              </h2>
              <ul className="flex flex-col gap-2.5">
                {view.request.scopes.map((scope) => (
                  <li key={scope.id} className="flex items-start gap-3 text-sm text-gray-200">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check size={12} />
                    </span>
                    {scope.description}
                  </li>
                ))}
              </ul>
            </section>

            <p className="flex items-start gap-2 text-xs text-gray-500">
              <ShieldCheck size={14} className="mt-px shrink-0" />
              <span>
                It can't see your password. You can disconnect it anytime from Connected apps in your
                account menu. You'll be sent back to {view.request.redirectHost}.
              </span>
            </p>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                <CircleAlert size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => decide(false)}
                disabled={busy !== null}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "deny" && <Spinner size={14} />}
                Deny
              </button>
              <button
                type="button"
                onClick={() => decide(true)}
                disabled={busy !== null}
                className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy === "allow" && <Spinner size={14} />}
                Allow
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ConnectPage;
