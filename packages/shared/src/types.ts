import { z } from "zod";
import {
  accountDeleteSchema,
  adminLoanDecisionSchema,
  authLoginSchema,
  authRegisterSchema,
  authVerifyEmailSchema,
  blacklistStudentSchema,
  dashboardSchema,
  loanApplySchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  paymentMethodSchema,
  paymentWebhookSchema,
  repaymentInitiateSchema,
  repaymentPlanSchema,
  loanStatusSchema,
  repaymentStatusSchema,
  studentProfileSchema,
  studentUploadIdSchema,
  subscribeSchema,
  subscriptionTierSchema,
  userSchema,
  verificationStatusSchema,
  verifyStudentSchema
} from "./schemas.js";

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthVerifyEmailInput = z.infer<typeof authVerifyEmailSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type AccountDeleteInput = z.infer<typeof accountDeleteSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type StudentUploadIdInput = z.infer<typeof studentUploadIdSchema>;
export type LoanApplyInput = z.infer<typeof loanApplySchema>;
export type RepaymentInitiateInput = z.infer<typeof repaymentInitiateSchema>;
export type SubscribeInput = z.infer<typeof subscribeSchema>;
export type PaymentWebhookInput = z.infer<typeof paymentWebhookSchema>;
export type AdminLoanDecisionInput = z.infer<typeof adminLoanDecisionSchema>;
export type BlacklistStudentInput = z.infer<typeof blacklistStudentSchema>;
export type VerifyStudentInput = z.infer<typeof verifyStudentSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>;
export type RepaymentPlan = z.infer<typeof repaymentPlanSchema>;
export type User = z.infer<typeof userSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type LoanStatus = z.infer<typeof loanStatusSchema>;
export type RepaymentStatus = z.infer<typeof repaymentStatusSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export type PaymentKind = "disbursement" | "repayment" | "subscription";
export type PaymentStatus = "pending" | "settled" | "failed";

export type Payment = {
  id: string;
  userId: string;
  loanId: string | null;
  kind: PaymentKind;
  amount: number;
  currency: string;
  provider: string;
  providerRef: string;
  status: PaymentStatus;
  createdAt: string;
  settledAt: string | null;
};

export type LoanQuote = {
  amount: number;
  fee: number;
  repaymentAmount: number;
  termDays: number;
  apr: number;
};

export type LoanApplication = {
  id: string;
  studentId: string;
  amount: number;
  purpose: LoanApplyInput["purpose"];
  expectedRepaymentDate: string;
  status: "pending_review" | "approved" | "rejected";
  createdAt: string;
  decisionReason?: string;
};

export type Loan = {
  id: string;
  applicationId: string;
  studentId: string;
  amount: number;
  fee: number;
  repaymentAmount: number;
  dueDate: string;
  status: LoanStatus;
  plan: RepaymentPlan;
  installmentCount: number;
  disbursedAt: string | null;
  createdAt: string;
};

export type Repayment = {
  id: string;
  loanId: string;
  studentId: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: RepaymentStatus;
  method?: string | null;
  // 1-based position within an installment plan (1/1 for a bullet loan).
  installmentNumber?: number;
  installmentsTotal?: number;
};

// Result of POST /loans/apply. Approved loans are disbursed through the payment
// rails (instant when the provider settles synchronously, otherwise `payment` is
// pending and settled via webhook); larger amounts queue for admin review.
export type LoanApplyResult =
  | { status: "disbursed"; loan: Loan; repayment: Repayment; payment: Payment }
  | { status: "pending_review"; application: LoanApplication };

// Result of POST /repayments/initiate: the charge is created on the rails; the loan
// is only marked repaid once the payment settles (synchronously, or via webhook).
export type RepaymentResult = {
  repayment: Repayment;
  payment: Payment;
  loanStatus: LoanStatus;
};

export type AdminDashboard = {
  pendingApplications: number;
  pendingIdVerifications: number;
  activeLoans: number;
  repaymentsDue: number;
  overdueLoans: number;
  verifiedStudents: number;
};
