import { loadYouTubeApi, YT_STATE, type YTPlayer } from "./youtube";

/**
 * One YouTube player for the whole session.
 *
 * Browsers often won't start a YouTube iframe that was created while its tab
 * was in the background, which is exactly when ChatGPT starts a song: the
 * listener is in the ChatGPT tab. So the player is created once, early, while
 * the tab is visible (see `prepareYouTubePlayer`), and then only ever switches
 * videos.
 *
 * An iframe reloads if it's moved in the DOM, so the player lives in its own
 * fixed-position box on <body> and is laid over whichever element the
 * <YouTubeEngine> gives it (`attachYouTubePlayer`). With nothing attached it
 * waits off screen.
 */

export interface PlayerHandlers {
  onStateChange?: (state: number, player: YTPlayer) => void;
  onError?: (code: number) => void;
}

const READY_TIMEOUT_MS = 20000;
/** YouTube won't play in players smaller than 200x200, so park it at a real size */
const PARKED = { left: "-10000px", top: "0px", width: "480px", height: "270px", clipPath: "none" };

let host: HTMLDivElement | null = null;
let playerPromise: Promise<YTPlayer> | null = null;
let created: YTPlayer | null = null;
let handlers: PlayerHandlers = {};
let slot: HTMLElement | null = null;
/** The slot's ancestors that clip it (scroll areas), found when attaching */
let clippers: HTMLElement[] = [];
let frame = 0;

function ensureHost() {
  if (host) return host;
  host = document.createElement("div");
  Object.assign(host.style, {
    position: "fixed",
    zIndex: "20",
    overflow: "hidden",
    borderRadius: "4px",
    background: "#000",
    ...PARKED,
  });
  document.body.appendChild(host);
  return host;
}

/** The session's player, created on first use */
export function getYouTubePlayer(): Promise<YTPlayer> {
  playerPromise ??= loadYouTubeApi()
    .then(
      (YT) =>
        new Promise<YTPlayer>((resolve, reject) => {
          const box = ensureHost();
          box.replaceChildren();
          // YT.Player replaces this element with its <iframe>
          const mount = document.createElement("div");
          box.appendChild(mount);
          const timer = window.setTimeout(() => reject(new Error("The YouTube player didn't load")), READY_TIMEOUT_MS);
          new YT.Player(mount, {
            width: "100%",
            height: "100%",
            playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
            events: {
              onReady: ({ target }) => {
                window.clearTimeout(timer);
                created = target;
                resolve(target);
              },
              onStateChange: ({ data, target }) => handlers.onStateChange?.(data, target),
              onError: ({ data }) => handlers.onError?.(data),
            },
          });
        }),
    )
    .catch((err) => {
      playerPromise = null; // try again next time
      throw err;
    });
  return playerPromise;
}

/**
 * Creates the player as soon as the tab is visible, so it's ready before a
 * remote command arrives while the listener is in another tab.
 */
export function prepareYouTubePlayer(): () => void {
  const prepare = () => {
    if (document.hidden) return;
    document.removeEventListener("visibilitychange", prepare);
    getYouTubePlayer().catch(() => {});
  };
  prepare();
  if (document.hidden) document.addEventListener("visibilitychange", prepare);
  return () => document.removeEventListener("visibilitychange", prepare);
}

/** Who gets the player's events (the mounted <YouTubeEngine>) */
export function setYouTubeHandlers(next: PlayerHandlers) {
  handlers = next;
}

/** The player's real state (YT_STATE), or null before it exists */
export function youtubeState(): number | null {
  try {
    return created ? created.getPlayerState() : null;
  } catch {
    return null;
  }
}

export const youtubeIsPlaying = () => youtubeState() === YT_STATE.PLAYING;

function clippingAncestors(element: HTMLElement) {
  const found: HTMLElement[] = [];
  for (let el = element.parentElement; el && el !== document.body; el = el.parentElement) {
    const { overflow, overflowX, overflowY } = getComputedStyle(el);
    if (/(auto|scroll|hidden|clip)/.test(overflow + overflowX + overflowY)) found.push(el);
  }
  return found;
}

/** Keeps the player's box on top of the slot, clipped to its scroll containers */
function follow() {
  frame = 0;
  if (!slot || !host) return;
  const rect = slot.getBoundingClientRect();
  if (!slot.isConnected || rect.width === 0 || rect.height === 0) {
    Object.assign(host.style, PARKED);
  } else {
    let top = 0;
    let left = 0;
    let bottom = window.innerHeight;
    let right = window.innerWidth;
    for (const el of clippers) {
      const r = el.getBoundingClientRect();
      top = Math.max(top, r.top);
      left = Math.max(left, r.left);
      bottom = Math.min(bottom, r.bottom);
      right = Math.min(right, r.right);
    }
    const inset = [
      Math.max(0, top - rect.top),
      Math.max(0, rect.right - right),
      Math.max(0, rect.bottom - bottom),
      Math.max(0, left - rect.left),
    ];
    Object.assign(host.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      clipPath: inset.some(Boolean) ? `inset(${inset.map((n) => `${n}px`).join(" ")})` : "none",
    });
  }
  frame = requestAnimationFrame(follow);
}

/** Shows the player over `element` until the returned function is called */
export function attachYouTubePlayer(element: HTMLElement): () => void {
  ensureHost();
  slot = element;
  clippers = clippingAncestors(element);
  if (!frame) frame = requestAnimationFrame(follow);
  return () => {
    if (slot !== element) return;
    slot = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (host) Object.assign(host.style, PARKED);
  };
}
