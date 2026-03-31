/**
 * Base URL for all API calls.
 *
 * - Web (dev/prod):  VITE_API_URL is empty → relative URLs like /api/... work fine
 * - Android APK:     Set VITE_API_URL=https://your-deployed-backend.com in .env
 *                    so the app talks to your real server instead of localhost
 */
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Prepend base URL to an API path */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
