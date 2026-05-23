import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/forgot-password"];
const AUTH_ALLOW_AUTHENTICATED = ["/auth/reset-password", "/auth/check-email", "/auth/callback"];
// Routes that are public (no auth required) but should redirect logged-in users away
const PUBLIC_LANDING = "/";

/**
 * Per-request session refresh + route gating.
 *
 * Refreshes the Supabase session cookie if needed, then enforces:
 * - Unauthenticated visitor + non-auth route → /auth/login?redirect={path}
 * - Authenticated visitor + login/signup/forgot-password → /
 * - Authenticated visitor + reset-password / check-email / callback → allow
 *   (they got here from an email link or are in mid-flow).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase env yet → don't redirect anywhere; let the page render and
  // surface its own missing-env error. Avoids a redirect loop during setup.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthLoginish = AUTH_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthMidFlow = AUTH_ALLOW_AUTHENTICATED.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  const isLanding = path === PUBLIC_LANDING;

  // Unauthenticated visitor on a protected route → login
  if (!user && !isAuthLoginish && !isAuthMidFlow && !isLanding) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("redirect", path + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  // Authenticated visitor on landing page or auth pages → dashboard
  if (user && (isAuthLoginish || isLanding)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
