export const appName = "PulaCash";

export const allowedInstitutionDomains = [
  "ub.ac.bw",
  "buan.ac.bw",
  "bac.ac.bw",
  "bitri.co.bw",
  "baisago.ac.bw",
  "botho.ac.bw"
] as const;

export const loanPurposes = [
  "Food and groceries",
  "Transport",
  "Books and supplies",
  "Emergency medical",
  "Accommodation",
  "Other urgent need"
] as const;

export const loanLifecycle = [
  "pending_review",
  "approved",
  "disbursed",
  "repayment_due",
  "repaid",
  "rejected"
] as const;

export const repaymentStatuses = ["scheduled", "due", "paid", "overdue"] as const;

export const studentVerificationStatuses = [
  "email_pending",
  "email_verified",
  "id_pending",
  "verified",
  "rejected"
] as const;

export const scoreBands = [
  { min: 90, label: "Excellent", color: "#0FBF8F" },
  { min: 70, label: "Good", color: "#106CFF" },
  { min: 50, label: "Building", color: "#F5A524" },
  { min: 0, label: "New", color: "#7A8AA0" }
] as const;

export const defaultLoanLimits = {
  startingLimit: 2000,
  availableToBorrow: 600,
  minAmount: 50,
  // Hard ceiling on a single loan. Enforced in validation but intentionally
  // not surfaced anywhere in the UI.
  maxAmount: 2000,
  // Loans are repaid with 25% interest (repayment = amount * (1 + feeRate)).
  feeRate: 0.25,
  // Loans up to this amount are auto-approved and disbursed instantly; above it
  // they fall back to admin review. Matches the hidden hard cap.
  autoApproveThreshold: 2000,
  defaultScore: 72
} as const;

// Default amount pre-selected on the loan request screen.
export const defaultBorrowAmount = 600;

export function isApprovedStudentEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain && allowedInstitutionDomains.includes(domain as (typeof allowedInstitutionDomains)[number]));
}

export function scoreBandFor(score: number) {
  return scoreBands.find((band) => score >= band.min) ?? scoreBands[scoreBands.length - 1]!;
}
