import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is not set. Add it to .env.local.");
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  // Browser-only: server-side fetches need a different code path (a server
  // Supabase client + cookie headers). Throw rather than send unauthenticated.
  if (typeof window === "undefined") {
    throw new ApiError(401, "NO_SESSION", "apiFetch is browser-only");
  }
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError(401, "NO_SESSION", "No session");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const hasBody = init.body != null;
  const authHeader = await getAuthHeader();

  const headers: HeadersInit = {
    ...authHeader,
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(init.headers ?? {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    // Session expired or token rejected — bounce to login with redirect.
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
    }
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication required");
  }

  if (!response.ok) {
    let code = String(response.status);
    let message = response.statusText;
    try {
      const body = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (body.error) {
        message = body.error.message ?? message;
        code = body.error.code ?? code;
      }
    } catch {
      // body wasn't JSON — fall back to statusText already set above
    }
    throw new ApiError(response.status, code, message);
  }

  return response.json() as Promise<T>;
}
