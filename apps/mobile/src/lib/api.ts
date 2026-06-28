import * as SecureStore from "expo-secure-store";
import { PaymentMethod, User } from "@pulacash/shared";
import { endpoints } from "./endpoints";

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

// --- Auth actions (wrap the network call + token persistence). All routes come
// from the central `endpoints` map — screens never hard-code raw URL strings. ---

type AuthResponse = { token: string; user: User; demoVerificationCode?: string };

/** Register a new student. Persists the returned session and surfaces the dev code (if any). */
export async function signUp(input: { email: string; fullName: string; password: string }): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>(endpoints.auth.register, { method: "POST", body: JSON.stringify(input) });
  await setAuthToken(result.token);
  return result;
}

/** Sign in with email + password. Persists the returned session token. */
export async function signIn(input: { email: string; password: string }): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>(endpoints.auth.login, { method: "POST", body: JSON.stringify(input) });
  await setAuthToken(result.token);
  return result;
}

export async function verifyEmailCode(input: { email: string; code: string }): Promise<{ verified: boolean }> {
  return apiFetch(endpoints.auth.verifyEmail, { method: "POST", body: JSON.stringify(input) });
}

export async function resendVerification(): Promise<{ demoVerificationCode?: string }> {
  return apiFetch(endpoints.auth.resendVerification, { method: "POST" });
}

export async function requestPasswordReset(email: string): Promise<{ demoResetCode?: string }> {
  return apiFetch(endpoints.auth.requestPasswordReset, { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(input: { email: string; code: string; newPassword: string }): Promise<{ ok: boolean }> {
  return apiFetch(endpoints.auth.resetPassword, { method: "POST", body: JSON.stringify(input) });
}

/** Permanently delete the account (re-authenticates with the current password). */
export async function deleteAccount(password: string): Promise<void> {
  await apiFetch(endpoints.account.delete, { method: "POST", body: JSON.stringify({ password, confirm: true }) });
  await clearAuthToken();
}

export async function subscribeToPlus(paymentMethod: PaymentMethod): Promise<{ user: User }> {
  return apiFetch(endpoints.subscriptions.subscribe, {
    method: "POST",
    body: JSON.stringify({ tier: "plus", paymentMethod })
  });
}

export async function cancelSubscription(): Promise<User> {
  return apiFetch(endpoints.subscriptions.cancel, { method: "POST" });
}

/** Revoke the session server-side (best effort) and clear it locally. */
export async function signOut(): Promise<void> {
  await apiFetch(endpoints.auth.logout, { method: "POST" }).catch(() => undefined);
  await clearAuthToken();
}
