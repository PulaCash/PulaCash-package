export const appName = "PulaCash";

/**
 * Legal / regulatory facts shared by the in-app Terms, Privacy Policy, and loan
 * agreement screens and the hostable Markdown copies in the repo root. PulaCash
 * operates under Botswana law; the contact address is the platform admin mailbox.
 */
export const legal = {
  company: "PulaCash",
  jurisdiction: "Republic of Botswana",
  governingLaw: "the laws of the Republic of Botswana",
  venue: "the courts of the Republic of Botswana",
  contactEmail: "tsenangthatayotlhe04@gmail.com",
  effectiveDate: "2026-06-28",
  regulator: "Non-Bank Financial Institutions Regulatory Authority (NBFIRA)",
  dataProtectionLaw: "Botswana Data Protection Act, 2018"
} as const;

/** Minimum password length accepted at registration (kept in sync with the schema). */
export const minPasswordLength = 8;

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
  // Per-tier borrowing ceilings (PulaCash+ unlocks the higher limit).
  freeTierLimit: 500,
  plusTierLimit: 2000,
  availableToBorrow: 500,
  minAmount: 50,
  // Absolute hard ceiling on a single loan (the PulaCash+ limit).
  maxAmount: 2000,
  // Flat 3% service fee (repayment = amount + round(amount * feeRate)). Combined
  // with the >=62-day minimum term this keeps the all-in APR well under Apple's
  // 36% cap (3% over 62 days ~= 17.7% APR), satisfying App Review Guideline 3.2.2.
  feeRate: 0.03,
  // Apple forbids requiring full repayment in <=60 days, so the minimum term is 62.
  minTermDays: 62,
  maxTermDays: 90,
  // Apple's maximum permitted APR for loan apps (including all fees).
  aprCap: 0.36,
  autoApproveThreshold: 2000,
  defaultScore: 72
} as const;

// Default amount + term pre-selected on the loan request screen.
export const defaultBorrowAmount = 500;
export const defaultTermDays = 62;

/**
 * Membership tiers. Revenue comes mainly from the optional PulaCash+ subscription
 * (a financial service billed via our payment rails, outside Apple IAP), keeping the
 * loan itself low-APR and Apple-compliant while the business stays profitable.
 */
export const subscriptionTiers = ["free", "plus"] as const;

export const membership = {
  free: {
    priceBwp: 0,
    currency: "BWP",
    limit: 500,
    benefits: ["Borrow up to P500", "Standard next-day disbursement", "Build your reliability score"]
  },
  plus: {
    priceBwp: 49,
    currency: "BWP",
    periodDays: 30,
    limit: 2000,
    benefits: [
      "Instant disbursement",
      "Borrow up to P2,000",
      "Priority application review",
      "Lower APR & faster credit building"
    ]
  }
} as const;

/** Mobile-money / card rails supported for disbursement and collection in Botswana. */
export const paymentMethods = ["orange_money", "myzaka", "smega", "card"] as const;

export const paymentMethodLabels: Record<(typeof paymentMethods)[number], string> = {
  orange_money: "Orange Money",
  myzaka: "MyZaka (Mascom)",
  smega: "Smega (BTC)",
  card: "Debit / Credit card"
};

/** Borrowing ceiling for a tier. */
export function tierLimit(tier: string): number {
  return tier === "plus" ? membership.plus.limit : membership.free.limit;
}

/** Annualised percentage rate as a fraction (e.g. 0.177), from a flat fee + term. */
export function computeApr(fee: number, principal: number, termDays: number): number {
  if (principal <= 0 || termDays <= 0) return 0;
  return (fee / principal) * (365 / termDays);
}

/** Full, disclosed quote for a loan of `amount` over `termDays`. */
export function loanQuote(amount: number, termDays: number = defaultTermDays) {
  const fee = Math.round(amount * defaultLoanLimits.feeRate);
  const repaymentAmount = amount + fee;
  return { amount, fee, repaymentAmount, termDays, apr: computeApr(fee, amount, termDays) };
}

export function isApprovedStudentEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return Boolean(domain && allowedInstitutionDomains.includes(domain as (typeof allowedInstitutionDomains)[number]));
}

export function scoreBandFor(score: number) {
  return scoreBands.find((band) => score >= band.min) ?? scoreBands[scoreBands.length - 1]!;
}
