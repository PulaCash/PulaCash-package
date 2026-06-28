import { useQuery } from "@tanstack/react-query";
import { User } from "@pulacash/shared";
import { apiFetch, demoAuthBypassEnabled } from "./api";
import { demoUser } from "./demo-data";
import { endpoints } from "./endpoints";

/**
 * The currently authenticated user (GET /me). Returns `undefined` when not signed
 * in, so role-gated UI fails closed. Only an opt-in dev bypass build falls back
 * to the placeholder demo user.
 */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await apiFetch<User>(endpoints.auth.me);
      } catch (error) {
        if (demoAuthBypassEnabled) return demoUser;
        throw error;
      }
    },
    retry: false
  });
}
