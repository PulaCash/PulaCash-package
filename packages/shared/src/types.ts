import { z } from "zod";
import {
  adminLoanDecisionSchema,
  authLoginSchema,
  authRegisterSchema,
  authVerifyEmailSchema,
  blacklistStudentSchema,
  dashboardSchema,
  loanApplySchema,
  repaymentInitiateSchema,
  loanStatusSchema,
  repaymentStatusSchema,
  studentProfileSchema,
  studentUploadIdSchema,
  userSchema,
  verificationStatusSchema,
  verifyStudentSchema
} from "./schemas.js";

export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthVerifyEmailInput = z.infer<typeof authVerifyEmailSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type StudentProfileInput = z.infer<typeof studentProfileSchema>;
export type StudentUploadIdInput = z.infer<typeof studentUploadIdSchema>;
export type LoanApplyInput = z.infer<typeof loanApplySchema>;
export type RepaymentInitiateInput = z.infer<typeof repaymentInitiateSchema>;
export type AdminLoanDecisionInput = z.infer<typeof adminLoanDecisionSchema>;
export type BlacklistStudentInput = z.infer<typeof blacklistStudentSchema>;
export type VerifyStudentInput = z.infer<typeof verifyStudentSchema>;
export type User = z.infer<typeof userSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type LoanStatus = z.infer<typeof loanStatusSchema>;
export type RepaymentStatus = z.infer<typeof repaymentStatusSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

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
};

// Result of POST /loans/apply: small loans are disbursed instantly, larger ones
// queue for admin review.
export type LoanApplyResult =
  | { status: "disbursed"; loan: Loan; repayment: Repayment }
  | { status: "pending_review"; application: LoanApplication };

export type AdminDashboard = {
  pendingApplications: number;
  pendingIdVerifications: number;
  activeLoans: number;
  repaymentsDue: number;
  overdueLoans: number;
  verifiedStudents: number;
};
