import { CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const Spinner = ({ size = 18 }: { size?: number }) => (
  <Loader2 size={size} className="animate-spin" aria-hidden="true" />
);

export const LoadingState = ({ label = "Loading…" }: { label?: string }) => (
  <div
    role="status"
    className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"
  >
    <Spinner />
    {label}
  </div>
);

export const ErrorState = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div
    role="alert"
    className="flex flex-col items-center gap-3 py-16 text-center text-sm text-gray-300"
  >
    <CircleAlert className="text-red-400" />
    <p>{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="rounded-full border border-white/30 px-4 py-1 hover:bg-white/10 cursor-pointer"
      >
        Try again
      </button>
    )}
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
    {Icon && <Icon size={40} strokeWidth={1.25} />}
    <p className="text-white">{title}</p>
    {children && <div className="text-sm flex flex-col items-center gap-3">{children}</div>}
  </div>
);

/** Inline error under a form */
export const FormError = ({ message }: { message?: string | null }) =>
  message ? (
    <p role="alert" className="text-sm text-red-400">
      {message}
    </p>
  ) : null;

export const PageTitle = ({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) => (
  <header className="flex items-center justify-between gap-3 mb-4">
    <h1 className="text-white text-xl font-medium">{title}</h1>
    {children}
  </header>
);

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-60 cursor-pointer transition-colors";
export const iconButton =
  "inline-flex items-center justify-center rounded-full p-2 text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
export const textInput =
  "w-full rounded-sm border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-white/40";
