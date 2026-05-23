import { apiFetch } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  createdAt: string;
}

/**
 * GET /api/user/me — fetches (and upserts on first call) the authenticated
 * user's profile from the database. Role comes from the `users` table, not
 * the JWT, so it reflects any manual DB-level role changes immediately.
 */
export async function getUserMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/user/me");
}
