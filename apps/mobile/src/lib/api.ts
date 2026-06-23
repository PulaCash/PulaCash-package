import * as SecureStore from "expo-secure-store";
import { demoAdminToken, demoToken } from "./demo-data";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
const tokenKey = "pulacash.authToken";
export const demoAuthBypassEnabled = process.env.EXPO_PUBLIC_DEMO_AUTH_BYPASS !== "false";

function demoTokenForRole(role: "student" | "admin" = "student") {
  return role === "admin" ? demoAdminToken : demoToken;
}

export async function setAuthToken(token: string) {
  await SecureStore.setItemAsync(tokenKey, token);
}

export async function continueAsDemoStudent() {
  if (demoAuthBypassEnabled) return;
  await setAuthToken(demoToken);
}

export async function clearAuthToken() {
  if (demoAuthBypassEnabled) return;
  await SecureStore.deleteItemAsync(tokenKey);
}

export async function getAuthToken(role: "student" | "admin" = "student") {
  if (demoAuthBypassEnabled) {
    return demoTokenForRole(role);
  }

  const token = await SecureStore.getItemAsync(tokenKey);
  return token ?? demoTokenForRole(role);
}

export async function apiFetch<T>(path: string, options: RequestInit & { role?: "student" | "admin" } = {}): Promise<T> {
  const token = await getAuthToken(options.role);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "PulaCash request failed.");
  }

  return (await response.json()) as T;
}
