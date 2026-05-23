"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  authErrorMessage,
  isValidEmail,
  maskEmail,
  passwordStrength,
} from "../auth-utils";
import { Field, Banner } from "../form-parts";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateName() {
    setErrors((p) => ({
      ...p,
      fullName:
        !fullName.trim()
          ? "Name is required."
          : fullName.trim().length < 2
            ? "Name must be at least 2 characters."
            : undefined,
    }));
  }
  function validateEmail() {
    setErrors((p) => ({
      ...p,
      email:
        !email
          ? "Email is required."
          : !isValidEmail(email)
            ? "Enter a valid email."
            : undefined,
    }));
  }
  function validatePassword() {
    setErrors((p) => ({
      ...p,
      password:
        !password
          ? "Password is required."
          : password.length < 8
            ? "Password must be at least 8 characters."
            : undefined,
    }));
  }
  function validateConfirm() {
    setErrors((p) => ({
      ...p,
      confirmPassword:
        confirmPassword !== password ? "Passwords do not match." : undefined,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Final validation pass on submit — covers untouched fields.
    const nextErrors: FieldErrors = {};
    if (!fullName.trim()) nextErrors.fullName = "Name is required.";
    else if (fullName.trim().length < 2) nextErrors.fullName = "Name must be at least 2 characters.";
    if (!email) nextErrors.email = "Email is required.";
    else if (!isValidEmail(email)) nextErrors.email = "Enter a valid email.";
    if (!password) nextErrors.password = "Password is required.";
    else if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords do not match.";

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    const { error } = await signUp(email, password, fullName.trim());
    setSubmitting(false);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    // Stash the unmasked email for the resend button on /auth/check-email.
    // Silently tolerate storage failures (private browsing modes can throw).
    try {
      sessionStorage.setItem("lucid:pending-confirmation-email", email);
    } catch {
      // ignore
    }
    router.replace(`/auth/check-email?email=${encodeURIComponent(maskEmail(email))}`);
  }

  const pwStrong = passwordStrength(password).strength === "strong";

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
          Create your account
        </h1>
        <p className="text-sm mt-1" style={{ color: "#64748B" }}>
          Start tracking your trading edge.
        </p>
      </div>

      {formError && <Banner kind="error">{formError}</Banner>}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          label="Full name"
          htmlFor="name"
          error={errors.fullName}
          input={
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={validateName}
              className="form-input"
              disabled={submitting}
            />
          }
        />

        <Field
          label="Email"
          htmlFor="email"
          error={errors.email}
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
          error={errors.password}
          hint={pwStrong ? undefined : "At least 8 characters."}
          input={
            <>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={validatePassword}
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
          label="Confirm password"
          htmlFor="confirm"
          error={errors.confirmPassword}
          input={
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={validateConfirm}
              className="form-input"
              disabled={submitting}
            />
          }
        />

        <button type="submit" disabled={submitting} className="form-submit">
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div
        className="mt-6 pt-6 text-center text-sm"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#64748B" }}
      >
        Already have an account?{" "}
        <Link href="/auth/login" style={{ color: "#60A5FA" }}>
          Sign in
        </Link>
      </div>
    </>
  );
}
