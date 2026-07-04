"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "../auth-utils";
import { Field, Banner } from "../form-parts";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

type SessionState = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Supabase parses the recovery token from the URL hash on mount and
  // populates a temporary session. If we have a session here, the token
  // was valid. If not, the link is expired/tampered.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSessionState(data.session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    let valid = true;
    if (!password || password.length < 8) {
      setPwError("Password must be at least 8 characters.");
      valid = false;
    } else {
      setPwError(null);
    }
    if (confirmPassword !== password) {
      setConfirmError("Passwords do not match.");
      valid = false;
    } else {
      setConfirmError(null);
    }
    if (!valid) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    // Sign out the recovery session so the user logs in fresh with the new
    // password.
    await supabase.auth.signOut();
    router.replace("/auth/login?reset=success");
  }

  if (sessionState === "checking") {
    return (
      <div className="text-sm" style={{ color: "#64748B" }}>
        Verifying reset link…
      </div>
    );
  }

  if (sessionState === "invalid") {
    return (
      <>
        <div className="mb-4">
          <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
            Reset link expired
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "#94A3B8" }}>
            This password reset link is invalid or has expired. Request a new
            one to continue.
          </p>
        </div>
        <Link
          href="/auth/forgot-password"
          className="form-submit inline-block text-center no-underline"
        >
          Request new link
        </Link>
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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
          Set a new password
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Choose a password you don&apos;t use anywhere else.
        </p>
      </div>

      {formError && <Banner kind="error">{formError}</Banner>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          label="New password"
          htmlFor="password"
          error={pwError}
          hint="At least 8 characters."
          input={
            <>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pr-9"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: "#64748B" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrengthMeter password={password} />
            </>
          }
        />

        <Field
          label="Confirm new password"
          htmlFor="confirm"
          error={confirmError}
          input={
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              disabled={submitting}
            />
          }
        />

        <button type="submit" disabled={submitting} className="form-submit">
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
    </>
  );
}
