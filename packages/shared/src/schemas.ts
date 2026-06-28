import { z } from "zod";
import {
  allowedInstitutionDomains,
  loanLifecycle,
  loanPurposes,
  paymentMethods,
  repaymentStatuses,
  studentVerificationStatuses,
  subscriptionTiers
} from "./constants.js";

const emailDomainError = `Use an approved student email domain: ${allowedInstitutionDomains.join(", ")}`;

export const studentEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .refine((email) => {
    const domain = email.split("@")[1];
    return Boolean(domain && allowedInstitutionDomains.includes(domain as (typeof allowedInstitutionDomains)[number]));
  }, emailDomainError);

export const idParamSchema = z.object({
  id: z.string().uuid()
});

// Any well-formed email may *sign in* (the admin mailbox is a normal address, not
// an institutional one). The institutional-domain rule only gates *registration*.
export const emailSchema = z.string().trim().toLowerCase().email();

// Password policy: 8–128 chars. Length is the dominant strength factor, so we keep
// the rule simple and let users pick long passphrases rather than forcing classes.
export const passwordSchema = z.string().min(8).max(128);

export const authRegisterSchema = z.object({
  email: studentEmailSchema,
  fullName: z.string().trim().min(2).max(120),
  password: passwordSchema
});

export const authVerifyEmailSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email.")
});

export const authLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export const authLogoutSchema = z.object({}).optional();

// Forgot-password: request a reset code, then set a new password with it. Both are
// rate-limited and the request endpoint never reveals whether the email exists.
export const passwordResetRequestSchema = z.object({
  email: emailSchema
});

export const passwordResetSchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
  newPassword: passwordSchema
});

// In-app account deletion requires re-authentication with the current password.
export const accountDeleteSchema = z.object({
  password: passwordSchema,
  confirm: z.literal(true)
});

export const paymentMethodSchema = z.enum(paymentMethods);

export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  studentEmail: studentEmailSchema,
  institutionId: z.string().uuid(),
  studentNumber: z.string().trim().min(4).max(32),
  phoneNumber: z.string().trim().min(7).max(24)
});

export const studentUploadIdSchema = z.object({
  fileName: z.string().trim().min(4).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(5_000_000)
});

export const loanApplySchema = z.object({
  // P50–P2,000 (the per-tier ceiling is additionally enforced server-side). The
  // expected repayment date must be at least the minimum term out (checked server-side).
  amount: z.number().int().min(50).max(2_000),
  purpose: z.enum(loanPurposes),
  expectedRepaymentDate: z.string().date(),
  disbursementMethod: paymentMethodSchema.optional(),
  acceptedTerms: z.boolean().refine((value) => value, "Accept the loan terms before submitting.")
});

// The repayment amount is computed server-side from the loan — never supplied by the
// client — so a client cannot under-pay and still clear the debt. The caller only
// chooses which rail to pay from.
export const repaymentInitiateSchema = z.object({
  loanId: z.string().uuid(),
  method: paymentMethodSchema
});

export const subscribeSchema = z.object({
  tier: z.enum(["plus"]),
  paymentMethod: paymentMethodSchema
});

// Payment provider webhook payload (kept permissive across providers; the signature
// is what's actually trusted — see the webhook route).
export const paymentWebhookSchema = z.object({
  reference: z.string().min(1).max(200),
  status: z.enum(["settled", "failed"])
});

export const adminLoanDecisionSchema = z.object({
  reason: z.string().trim().max(400).optional()
});

export const blacklistStudentSchema = z.object({
  blacklisted: z.boolean(),
  reason: z.string().trim().min(4).max(400)
});

// Admin identity-verification decision for an uploaded student ID (the human KYC
// step that moves a student from `id_pending` to `verified` / `rejected`).
export const verifyStudentSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().max(400).optional()
});

export const loanStatusSchema = z.enum(loanLifecycle);
export const repaymentStatusSchema = z.enum(repaymentStatuses);
export const verificationStatusSchema = z.enum(studentVerificationStatuses);

export const subscriptionTierSchema = z.enum(subscriptionTiers);

export const userSchema = z.object({
  id: z.string().uuid(),
  // A user may be a student (institutional email) or the admin (ordinary mailbox),
  // so the User contract accepts any valid email — the domain rule lives on register.
  email: emailSchema,
  fullName: z.string(),
  role: z.enum(["student", "admin"]),
  isBlacklisted: z.boolean(),
  emailVerified: z.boolean().default(false),
  subscriptionTier: subscriptionTierSchema.default("free"),
  subscriptionRenewsAt: z.string().nullable().default(null)
});

export const dashboardSchema = z.object({
  student: z.object({
    name: z.string(),
    initials: z.string(),
    institution: z.string(),
    verificationStatus: verificationStatusSchema
  }),
  borrowing: z.object({
    available: z.number(),
    limit: z.number(),
    activeLoanAmount: z.number().nullable(),
    lastDisbursedAmount: z.number().nullable(),
    nextDueDate: z.string().date().nullable()
  }),
  reliability: z.object({
    score: z.number().int().min(0).max(100),
    label: z.string()
  }),
  membership: z.object({
    tier: subscriptionTierSchema,
    renewsAt: z.string().nullable(),
    limit: z.number()
  }),
  nudges: z.array(z.string())
});
