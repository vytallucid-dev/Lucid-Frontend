"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage, isValidEmail } from "../auth-utils";
import { Field, Banner } from "../form-parts";

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email) {
      setEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email.");
      return;
    }

    setSubmitting(true);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);
    // Security: never reveal whether the account exists. Always show the
    // "check your email" success state on success path. The only errors we
    // surface are network/rate-limit — not "user not found".
    if (error) {
      const mapped = authErrorMessage(error);
      // Treat anything except network/rate-limit as a silent success so we
      // don't leak account existence via error text.
      if (
        mapped &&
        (mapped.toLowerCase().includes("network") || mapped.toLowerCase().includes("too many"))
      ) {
        setFormError(mapped);
        return;
      }
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <>
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 size={22} style={{ color: "#10B981" }} />
          <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
            Check your email
          </h1>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
          If an account exists for that email, we&apos;ve sent a reset link. The
          link expires in 1 hour.
        </p>
        <div className="mt-6 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/auth/login" className="text-sm" style={{ color: "#dcbf78" }}>
            ← Back to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
          Forgot password?
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {formError && <Banner kind="error">{formError}</Banner>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          label="Email"
          htmlFor="email"
          error={emailError}
          input={
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (!email) setEmailError("Email is required.");
                else if (!isValidEmail(email)) setEmailError("Enter a valid email.");
                else setEmailError(null);
              }}
              className="form-input"
              disabled={submitting}
            />
          }
        />

        <button type="submit" disabled={submitting} className="form-submit">
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div
        className="mt-6 pt-6 text-center text-sm"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#64748B" }}
      >
        <Link href="/auth/login" style={{ color: "#dcbf78" }}>
          ← Back to login
        </Link>
      </div>
    </>
  );
}
