import { z } from "zod";
import {
  allowedInstitutionDomains,
  loanLifecycle,
  loanPurposes,
  repaymentStatuses,
  studentVerificationStatuses
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

export const authRegisterSchema = z.object({
  email: studentEmailSchema,
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128)
});

export const authVerifyEmailSchema = z.object({
  email: studentEmailSchema,
  code: z.string().trim().min(4).max(12)
});

export const authLoginSchema = z.object({
  email: studentEmailSchema,
  password: z.string().min(8).max(128)
});

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
  // Hidden hard cap of P2,000 per loan — enforced here but never advertised in
  // the UI. Amounts at/under the auto-approve threshold disburse instantly.
  amount: z.number().int().min(50).max(2_000),
  purpose: z.enum(loanPurposes),
  expectedRepaymentDate: z.string().date(),
  acceptedTerms: z.boolean().refine((value) => value, "Accept the loan terms before submitting.")
});

export const repaymentInitiateSchema = z.object({
  loanId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(["manual_bank_transfer", "campus_cash_office", "future_provider_placeholder"])
});

export const adminLoanDecisionSchema = z.object({
  reason: z.string().trim().max(400).optional()
});

export const blacklistStudentSchema = z.object({
  blacklisted: z.boolean(),
  reason: z.string().trim().min(4).max(400)
});

export const loanStatusSchema = z.enum(loanLifecycle);
export const repaymentStatusSchema = z.enum(repaymentStatuses);
export const verificationStatusSchema = z.enum(studentVerificationStatuses);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: studentEmailSchema,
  fullName: z.string(),
  role: z.enum(["student", "admin"]),
  isBlacklisted: z.boolean()
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
  nudges: z.array(z.string())
});
