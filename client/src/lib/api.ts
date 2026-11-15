// Base URL of the XMusic API. Override with VITE_API_URL in client/.env.local
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";
