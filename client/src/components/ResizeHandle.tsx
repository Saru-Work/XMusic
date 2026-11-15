import { useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Accessible name, e.g. "Resize sidebar" */
  label: string;
  /** Current width in px of the panel this handle resizes */
  value: number;
  min: number;
  max: number;
  /** Width restored on double-click */
  defaultValue: number;
  /** +1 when dragging right makes the panel wider, -1 when it makes it narrower */
  direction: 1 | -1;
  onChange: (width: number) => void;
  className?: string;
}

const KEY_STEP = 16;

/**
 * While dragging, `body.is-resizing` (see index.css) disables text selection
 * and makes embedded iframes ignore the pointer. Without that, a fast drag
 * onto the YouTube player hands the pointer to the iframe and the drag stalls.
 */
function setResizing(active: boolean) {
  document.body.classList.toggle("is-resizing", active);
}

/**
 * Vertical divider between two sections. Drag it, use the arrow keys while it
 * is focused, or double-click to reset.
 */
const ResizeHandle = ({
  label,
  value,
  min,
  max,
  defaultValue,
  direction,
  onChange,
  className,
}: Props) => {
  const drag = useRef<{ startX: number; startValue: number } | null>(null);
  const clamp = (width: number) => Math.round(Math.min(max, Math.max(min, width)));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      className={cn(
        "group w-3 shrink-0 cursor-col-resize touch-none items-stretch justify-center outline-none",
        className,
      )}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { startX: e.clientX, startValue: value };
        setResizing(true);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        if (e.buttons === 0) {
          // The button was released somewhere we didn't see: end the drag
          drag.current = null;
          setResizing(false);
          return;
        }
        const delta = (e.clientX - drag.current.startX) * direction;
        onChange(clamp(drag.current.startValue + delta));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        setResizing(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setResizing(false);
      }}
      onDoubleClick={() => onChange(clamp(defaultValue))}
      onKeyDown={(e) => {
        let next: number | null = null;
        if (e.key === "ArrowRight") next = value + KEY_STEP * direction;
        else if (e.key === "ArrowLeft") next = value - KEY_STEP * direction;
        else if (e.key === "Home") next = min;
        else if (e.key === "End") next = max;
        else if (e.key === "Enter") next = defaultValue;
        if (next === null) return;
        e.preventDefault();
        onChange(clamp(next));
      }}
    >
      <span className="w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-white/40 group-focus-visible:bg-white/70 group-active:bg-white/70" />
    </div>
  );
};

export default ResizeHandle;
