/** Playback speeds offered in the player */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export type SleepTimer =
  | { kind: "off" }
  /** Pause at this time (ms since epoch) */
  | { kind: "at"; time: number; minutes: number }
  /** Pause when the current song finishes */
  | { kind: "end" };
