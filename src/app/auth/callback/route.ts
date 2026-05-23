import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-confirmation / OAuth-return handler. Supabase redirects users here
 * after they click the link in their confirmation email — we exchange the
 * `code` for a session and drop them at home (or wherever `?next=` says).
 *
 * Designed to handle both email-confirmation AND future OAuth flows; both
 * use the same `?code=` query param contract.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=callback_missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
