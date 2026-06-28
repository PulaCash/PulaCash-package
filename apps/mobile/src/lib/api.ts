import * as SecureStore from "expo-secure-store";
import { User } from "@pulacash/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const tokenKey = "pulacash.authToken";

/**
 * Demo auth bypass is OFF by default and can only be enabled in a *dev* build that
 * explicitly opts in (`EXPO_PUBLIC_DEMO_AUTH_BYPASS=true`). `__DEV__` is false in a
 * production/release bundle, so a shipped app can never run in bypass mode.
 */
export const demoAuthBypassEnabled = __DEV__ && process.env.EXPO_PUBLIC_DEMO_AUTH_BYPASS === "true";

/** Error carrying the HTTP status so callers can detect 401s and route to sign-in. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let cachedToken: string | null = null;

export async function setAuthToken(token: string) {
  cachedToken = token;
  await SecureStore.setItemAsync(tokenKey, token);
}

export async function getStoredToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(tokenKey);
  return cachedToken;
}

export async function clearAuthToken() {
  cachedToken = null;
  await SecureStore.deleteItemAsync(tokenKey);
}

/** Whether the app currently holds a session (or is in an opt-in dev bypass build). */
export async function isAuthenticated(): Promise<boolean> {
  if (demoAuthBypassEnabled) return true;
  return (await getStoredToken()) != null;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "PulaCash request failed.", response.status);
  }

  return (await response.json()) as T;
}

// --- Auth actions (wrap the network call + token persistence) ---

type AuthResponse = { token: string; user: User; demoVerificationCode?: string };

/** Register a new student. Persists the returned session and surfaces the dev code (if any). */
export async function signUp(input: { email: string; fullName: string; password: string }): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) });
  await setAuthToken(result.token);
  return result;
}

/** Sign in with email + password. Persists the returned session token. */
export async function signIn(input: { email: string; password: string }): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) });
  await setAuthToken(result.token);
  return result;
}

export async function verifyEmailCode(input: { email: string; code: string }): Promise<{ verified: boolean }> {
  return apiFetch("/auth/verify-email", { method: "POST", body: JSON.stringify(input) });
}

export async function resendVerification(): Promise<{ demoVerificationCode?: string }> {
  return apiFetch("/auth/resend-verification", { method: "POST" });
}

/** Revoke the session server-side (best effort) and clear it locally. */
export async function signOut(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
  await clearAuthToken();
}
