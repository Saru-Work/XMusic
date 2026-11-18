import { api } from "./api";

/** The parts of Google Identity Services ("Sign in with Google") we use */
export interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      /** Button language; defaults to the browser's */
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

let configPromise: Promise<string | null> | null = null;
let scriptPromise: Promise<GoogleIdentity> | null = null;

/** The server's Google client id, or null when Google sign-in is off */
export function googleClientId(): Promise<string | null> {
  configPromise ??= api<{ clientId: string | null }>("/login/google/config")
    .then((data) => data.clientId)
    .catch(() => {
      configPromise = null; // try again next time
      return null;
    });
  return configPromise;
}

/** Loads Google's sign-in script once */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  scriptPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error("Google sign-in didn't load."));
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error("Google sign-in couldn't load. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}
