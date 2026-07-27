import type { Account } from "./demo-data";

// The single source of truth for "is this balance real, managed capital, or
// just a challenge-in-progress." Every place that aggregates account
// balances (dashboard hero, accounts page header, etc.) must derive its
// totals from this module — no component re-implements any part of this
// rule.
//
// Demo balances are practice, not capital. Non-active accounts are history.
// Neither is money being managed.
export type CapitalRole = "managed" | "evaluation" | "excluded";

export function capitalRole(account: Account): CapitalRole {
  if (account.status !== "Active") return "excluded";

  if (account.account_type === "personal") return "managed";

  if (account.account_type === "prop_firm") {
    if (account.stage === "Funded") return "managed";
    if (account.stage === "Stage 1" || account.stage === "Stage 2") return "evaluation";
    return "excluded"; // stage missing or 'Blown' — fail safe, don't over-count
  }

  // 'demo' and any unrecognised account_type
  return "excluded";
}

export function managedCapital(accounts: Account[]): number {
  return accounts.filter((a) => capitalRole(a) === "managed").reduce((s, a) => s + a.current_balance, 0);
}

export function evaluationCapital(accounts: Account[]): number {
  return accounts.filter((a) => capitalRole(a) === "evaluation").reduce((s, a) => s + a.current_balance, 0);
}

export function isLifecycleClosed(account: Account): boolean {
  return account.status !== "Active";
}
