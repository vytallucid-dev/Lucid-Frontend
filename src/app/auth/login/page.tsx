"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage, isValidEmail } from "../auth-utils";
import { Field, Banner } from "../form-parts";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 rounded bg-white/5" />
      <div className="h-10 w-full rounded bg-white/5" />
      <div className="h-10 w-full rounded bg-white/5" />
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordResetSuccess = searchParams.get("reset") === "success";

  function validateEmail() {
    if (!email) setEmailError("Email is required.");
    else if (!isValidEmail(email)) setEmailError("Enter a valid email.");
    else setEmailError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError("Email and password are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Enter a valid email.");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    const redirect = searchParams.get("redirect") || "/";
    router.replace(redirect);
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
          Welcome back
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Sign in to continue to Lucid.
        </p>
      </div>

      {passwordResetSuccess && (
        <Banner kind="success">
          Password updated. Sign in with your new password.
        </Banner>
      )}

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
              onBlur={validateEmail}
              className="form-input"
              disabled={submitting}
            />
          }
        />

        <Field
          label="Password"
          htmlFor="password"
          input={
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          }
        />

        <div className="flex justify-end">
          <Link
            href="/auth/forgot-password"
            className="text-xs"
            style={{ color: "#dcbf78" }}
          >
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={submitting} className="form-submit">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div
        className="mt-6 pt-6 text-center text-sm"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#64748B" }}
      >
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" style={{ color: "#dcbf78" }}>
          Sign up
        </Link>
      </div>
    </>
  );
}
