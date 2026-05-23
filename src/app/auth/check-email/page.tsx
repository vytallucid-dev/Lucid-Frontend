"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "../auth-utils";
import { Banner } from "../form-parts";

const RESEND_COOLDOWN_SECONDS = 60;

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="text-sm" style={{ color: "#64748B" }}>Loading…</div>}>
      <CheckEmailInner />
    </Suspense>
  );
}

function CheckEmailInner() {
  const searchParams = useSearchParams();
  const maskedEmail = searchParams.get("email") ?? "your email";

  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    let email: string | null = null;
    try {
      email = sessionStorage.getItem("lucid:pending-confirmation-email");
    } catch {
      // Private browsing or storage disabled — treated as missing.
    }

    if (!email) {
      // Stash cleared (user navigated away and back, or storage unavailable).
      // We can't recover the unmasked email; redirect them through signup.
      setStatus("error");
      setError("Your session expired. Please sign up again.");
      return;
    }

    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (resendError) {
      setStatus("error");
      setError(authErrorMessage(resendError));
      return;
    }
    setStatus("sent");
    startCooldown();
    // Stash is intentionally left in place — the user may need to resend
    // again, and it expires naturally with the browser session anyway.
  }

  return (
    <>
      <div className="flex items-center justify-center mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
          }}
        >
          <Mail size={22} style={{ color: "#60A5FA" }} />
        </div>
      </div>

      <h1
        className="text-xl font-semibold text-center mb-2"
        style={{ color: "#F1F5F9" }}
      >
        Check your email
      </h1>
      <p className="text-sm text-center leading-relaxed mb-6" style={{ color: "#94A3B8" }}>
        We&apos;ve sent a confirmation link to{" "}
        <span className="font-medium" style={{ color: "#F1F5F9" }}>
          {maskedEmail}
        </span>
        . Click the link in the email to verify your account.
      </p>

      {status === "sent" && (
        <Banner kind="success">Confirmation email re-sent. Check your inbox.</Banner>
      )}
      {status === "error" && error && <Banner kind="error">{error}</Banner>}

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || status === "sending"}
        className="form-submit"
      >
        {cooldown > 0
          ? `Resend in ${cooldown}s`
          : status === "sending"
            ? "Sending…"
            : "Resend email"}
      </button>

      <div
        className="mt-6 pt-6 text-center text-sm"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#64748B" }}
      >
        <Link href="/auth/login" style={{ color: "#60A5FA" }}>
          ← Back to login
        </Link>
      </div>
    </>
  );
}
