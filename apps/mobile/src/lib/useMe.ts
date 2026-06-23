import { useQuery } from "@tanstack/react-query";
import { User } from "@pulacash/shared";
import { apiFetch } from "./api";
import { demoUser } from "./demo-data";
import { endpoints } from "./endpoints";

/** The currently authenticated user (GET /me). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<User>(endpoints.auth.me).catch(() => demoUser),
    initialData: demoUser
  });
}
