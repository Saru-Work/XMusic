import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPEEDS, type SleepTimer } from "@/lib/playback";
import { iconButton } from "./States";

const SLEEP_MINUTES = [15, 30, 45, 60];

interface Props {
  rate: number;
  onRate: (rate: number) => void;
  sleep: SleepTimer;
  onSleep: (sleep: SleepTimer) => void;
  className?: string;
}

const chip = (active: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
    active
      ? "border-white bg-white text-black"
      : "border-white/25 text-gray-200 hover:bg-white/10",
  );

function sleepSummary(sleep: SleepTimer, now: number) {
  if (sleep.kind === "end") return "Pauses when this song ends";
  if (sleep.kind === "at") {
    const minutes = Math.max(1, Math.ceil((sleep.time - now) / 60000));
    return `Pauses in ${minutes} min`;
  }
  return "Off";
}

/** Playback speed and sleep timer, in a popover that opens above its button */
const PlayerOptions = ({ rate, onRate, sleep, onSleep, className }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Captured when the popover opens, for the "pauses in N min" text
  const [openedAt, setOpenedAt] = useState(0);
  const active = rate !== 1 || sleep.kind !== "off";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={cn(iconButton, active && "text-amber-400 hover:text-amber-300")}
        onClick={() => {
          setOpenedAt(Date.now());
          setOpen(!open);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Playback options"
        title="Speed and sleep timer"
      >
        <Settings2 size={16} />
      </button>
      {open && (
        <div
          role="group"
          aria-label="Playback options"
          className="absolute bottom-full right-0 z-50 mb-2 w-64 cursor-default rounded-md bg-[#1F1F1F] p-3 text-sm text-white shadow-2xl"
        >
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
            Speed
          </p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                className={chip(rate === speed)}
                aria-pressed={rate === speed}
                onClick={() => onRate(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
            Sleep timer
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              className={chip(sleep.kind === "off")}
              aria-pressed={sleep.kind === "off"}
              onClick={() => onSleep({ kind: "off" })}
            >
              Off
            </button>
            {SLEEP_MINUTES.map((minutes) => {
              const selected = sleep.kind === "at" && sleep.minutes === minutes;
              return (
                <button
                  key={minutes}
                  className={chip(selected)}
                  aria-pressed={selected}
                  onClick={() => {
                    const now = Date.now();
                    setOpenedAt(now);
                    onSleep({ kind: "at", time: now + minutes * 60000, minutes });
                  }}
                >
                  {minutes} min
                </button>
              );
            })}
            <button
              className={chip(sleep.kind === "end")}
              aria-pressed={sleep.kind === "end"}
              onClick={() => onSleep({ kind: "end" })}
            >
              End of song
            </button>
          </div>
          <p role="status" className="mt-3 text-xs text-gray-400">
            {sleepSummary(sleep, openedAt)}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerOptions;
