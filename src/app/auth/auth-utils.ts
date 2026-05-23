import type { AuthError } from "@supabase/supabase-js";

/**
 * Map Supabase auth errors to user-facing copy. Anything not matched falls
 * through to the original message, which is usually safe to show.
 */
export function authErrorMessage(error: AuthError | null): string | null {
  if (!error) return null;
  const msg = error.message.toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox.";
  }
  if (msg.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (msg.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("network") || msg.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }
  return error.message;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Mask the local-part of an email: "ajmix06@gmail.com" → "a***6@gmail.com".
 * For very short locals, keep just the first character.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local[0]}***${local[local.length - 1]}${domain}`;
}

export type PasswordStrength = "empty" | "weak" | "medium" | "strong";

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0..4
  label: string;
}

/**
 * Cheap-and-cheerful strength score: counts length tier + character classes
 * (lower, upper, digit, symbol). Not a substitute for zxcvbn; good enough
 * to nudge users away from "password1".
 */
export function passwordStrength(pw: string): PasswordStrengthResult {
  if (!pw) return { strength: "empty", score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Clamp to 4 — keeps the bar a 4-segment scale.
  score = Math.min(score, 4);
  if (score <= 1) return { strength: "weak", score, label: "Weak" };
  if (score <= 2) return { strength: "medium", score, label: "Fair" };
  if (score === 3) return { strength: "medium", score, label: "Good" };
  return { strength: "strong", score, label: "Strong" };
}
