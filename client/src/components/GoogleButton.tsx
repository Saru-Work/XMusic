import { useEffect, useRef, useState } from "react";
import { googleClientId, loadGoogleIdentity } from "@/lib/google";

interface Props {
  mode: "login" | "register";
  /** Called with Google's ID token after the user picks an account */
  onCredential: (credential: string) => void;
}

/** Google's widths are fixed px between these */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

/**
 * "Sign in with Google" button, rendered by Google Identity Services.
 * Renders nothing when the server has no Google client id.
 */
const GoogleButton = ({ mode, onCredential }: Props) => {
  const slot = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  const [state, setState] = useState<"loading" | "ready" | "off" | "error">("loading");

  useEffect(() => {
    latest.current = onCredential;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await googleClientId();
      if (cancelled) return;
      if (!clientId) return setState("off");
      try {
        const google = await loadGoogleIdentity();
        if (cancelled || !slot.current) return;
        google.initialize({
          client_id: clientId,
          callback: ({ credential }) => latest.current(credential),
          ux_mode: "popup",
          cancel_on_tap_outside: true,
        });
        const width = Math.round(slot.current.offsetWidth);
        google.renderButton(slot.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: mode === "login" ? "signin_with" : "signup_with",
          logo_alignment: "center",
          width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
          // Match the rest of XMusic, which is in English
          locale: "en",
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (state === "off") return null;
  return (
    <div className="flex flex-col gap-4">
      {/* Google draws its button into this element */}
      <div ref={slot} className="flex min-h-10 w-full justify-center" />
      {state === "error" && (
        <p className="text-center text-xs text-gray-400">
          Google sign-in couldn't load. You can still use your email.
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-white/15" />
        or
        <span className="h-px flex-1 bg-white/15" />
      </div>
    </div>
  );
};

export default GoogleButton;
