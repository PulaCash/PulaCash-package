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
  // Per-tier borrowing ceilings (PulaCash+ unlocks the higher limit). Free borrowers
  // get a single P300 taster loan; serious/repeat borrowers convert to PulaCash+.
  freeTierLimit: 300,
  plusTierLimit: 2000,
  availableToBorrow: 300,
  minAmount: 50,
  // Absolute hard ceiling on a single loan (the PulaCash+ limit).
  maxAmount: 2000,
  // Number of loans a free-tier student may take before PulaCash+ is required.
  freeLoanAllowance: 1,
  // The fee is term-scaled to a target APR (see loanFee). targetApr is what we aim
  // for; aprSafetyCap is a hard ceiling that guarantees the all-in APR — even after
  // rounding on small loans — stays under Apple's aprCap (Guideline 3.2.2).
  targetApr: 0.34,
  aprSafetyCap: 0.355,
  aprCap: 0.36,
  // Apple forbids requiring full repayment in <=60 days, so the minimum term is 62.
  minTermDays: 62,
  maxBulletTermDays: 90,
  // Absolute max term (covers a 4 x 31-day installment plan = 124 days).
  maxTermDays: 124,
  autoApproveThreshold: 2000,
  defaultScore: 72,
  // Installment ("monthly repayment") plans: PulaCash+ only, for larger loans.
  installmentMinAmount: 1000,
  installmentCounts: [2, 3, 4] as const,
  installmentPeriodDays: 31
} as const;

// Default amount + term pre-selected on the loan request screen.
export const defaultBorrowAmount = 300;
export const defaultTermDays = 62;

/**
 * Membership tiers. Revenue comes from a term-scaled loan fee (priced near, but
 * always under, Apple's 36% APR cap) plus the optional PulaCash+ subscription (a
 * financial service billed via our payment rails, outside Apple IAP). The free tier
 * is a deliberately limited on-ramp so meaningful borrowers convert to PulaCash+.
 */
export const subscriptionTiers = ["free", "plus"] as const;

export const membership = {
  free: {
    priceBwp: 0,
    currency: "BWP",
    limit: 300,
    benefits: ["Borrow up to P300", "One free loan to get started", "Build your reliability score"]
  },
  plus: {
    priceBwp: 49,
    currency: "BWP",
    periodDays: 30,
    limit: 2000,
    benefits: [
      "Borrow up to P2,000",
      "Unlimited loans",
      "Monthly installment repayment plans",
      "Instant disbursement & priority review"
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

export const repaymentPlans = ["bullet", "installment"] as const;

/** Borrowing ceiling for a tier. */
export function tierLimit(tier: string): number {
  return tier === "plus" ? membership.plus.limit : membership.free.limit;
}

/** Annualised percentage rate as a fraction (e.g. 0.34), from a fee + term. */
export function computeApr(fee: number, principal: number, termDays: number): number {
  if (principal <= 0 || termDays <= 0) return 0;
  return (fee / principal) * (365 / termDays);
}

/**
 * Term-scaled service fee. Targets `targetApr`, but is hard-clamped to the
 * `aprSafetyCap` ceiling so the resulting APR can never reach Apple's 36% cap, even
 * after rounding up on a small principal. Minimum P1 so no loan is fee-free.
 */
export function loanFee(principal: number, termDays: number): number {
  if (principal <= 0 || termDays <= 0) return 0;
  const target = principal * defaultLoanLimits.targetApr * (termDays / 365);
  const ceiling = Math.floor(principal * defaultLoanLimits.aprSafetyCap * (termDays / 365));
  return Math.max(1, Math.min(Math.round(target), ceiling));
}

/** Term length (days) for an N-installment monthly plan. */
export function installmentTermDays(count: number): number {
  return count * defaultLoanLimits.installmentPeriodDays;
}

/** Split a total into `count` monthly installments (the last absorbs any remainder). */
export function installmentSchedule(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const amounts = Array.from({ length: count }, () => base);
  amounts[count - 1] = total - base * (count - 1);
  return amounts;
}

/** Full, disclosed quote for a loan of `amount` over `termDays`. */
export function loanQuote(amount: number, termDays: number = defaultTermDays) {
  const fee = loanFee(amount, termDays);
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
