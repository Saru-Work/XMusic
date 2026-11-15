import { useCallback, useEffect, useState } from "react";

// Base URL of the XMusic API. Override with VITE_API_URL in client/.env.local
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  /** Sent as a JSON body */
  json?: unknown;
  /** Sent as multipart form data (file uploads) */
  form?: FormData;
}

/**
 * Calls the API with cookies included and returns the parsed JSON.
 * Throws an ApiError carrying the server's message when the request fails.
 */
export async function api<T = unknown>(
  path: string,
  { json, form, headers, ...init }: ApiOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...init,
      headers:
        json !== undefined
          ? { "Content-Type": "application/json", ...headers }
          : headers,
      body: json !== undefined ? JSON.stringify(json) : form,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check that it is running.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      res.status === 401
        ? "Please log in to continue."
        : "Something went wrong. Please try again.";
    throw new ApiError(data?.message || fallback, res.status);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Please try again.";
}

interface FetchState<T> {
  path: string | null;
  data?: T;
  error?: string;
}

/** Loads `path` (GET) and tracks loading / error state. Pass null to skip. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<FetchState<T>>({ path: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api<T>(path)
      .then((data) => {
        if (!cancelled) setState({ path, data });
      })
      .catch((err) => {
        if (!cancelled) setState({ path, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [path, reloadKey]);

  const current = state.path === path ? state : null;
  const setData = useCallback((update: (data: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }));
  }, []);
  const reload = useCallback(() => {
    setState({ path: null });
    setReloadKey((k) => k + 1);
  }, []);

  return {
    data: current?.data,
    error: current?.error,
    loading: Boolean(path) && !current,
    setData,
    reload,
  };
}
