import {
  AdminDashboard,
  Dashboard,
  defaultTermDays,
  Loan,
  LoanApplication,
  LoanApplyInput,
  LoanApplyResult,
  loanFee,
  Payment,
  Repayment,
  RepaymentResult,
  User
} from "@pulacash/shared";

// Neutral placeholder fixtures used only as an offline fallback for the UI. They
// contain no real personal data and carry no credentials.
export const demoUser: User = {
  id: "8a287637-708e-4382-b166-57f2d9b18121",
  email: "demo.student@ub.ac.bw",
  fullName: "Demo Student",
  role: "student",
  isBlacklisted: false,
  emailVerified: true,
  subscriptionTier: "plus",
  subscriptionRenewsAt: "2026-07-28",
  freeLoansUsed: 0
};

export const demoDashboard: Dashboard = {
  student: {
    name: demoUser.fullName,
    initials: "DS",
    institution: "University of Botswana",
    verificationStatus: "verified"
  },
  borrowing: {
    available: 2000,
    limit: 2000,
    activeLoanAmount: null,
    lastDisbursedAmount: null,
    nextDueDate: null
  },
  reliability: {
    score: 72,
    label: "Good"
  },
  membership: {
    tier: "plus",
    renewsAt: "2026-07-28",
    limit: 2000,
    freeLoansRemaining: 0
  },
  nudges: ["Repay on time to unlock higher limits."]
};

export const demoLoans: Loan[] = [
  {
    id: "3b96f4c7-4908-41ac-a65d-53c3dafed80a",
    applicationId: "e37a7d60-67f6-43cc-bdbc-3dd682674a66",
    studentId: "8a287637-708e-4382-b166-57f2d9b18121",
    amount: 600,
    fee: 35,
    repaymentAmount: 635,
    dueDate: "2026-09-01",
    status: "disbursed",
    plan: "bullet",
    installmentCount: 1,
    disbursedAt: "2026-06-30T12:00:00.000Z",
    createdAt: "2026-06-30T12:00:00.000Z"
  },
  {
    id: "71c94799-e1fc-4b1d-99cd-717599219f8e",
    applicationId: "18dff7b8-6555-41e1-9f7b-9e942e8bf585",
    studentId: "8a287637-708e-4382-b166-57f2d9b18121",
    amount: 200,
    fee: 12,
    repaymentAmount: 212,
    dueDate: "2026-05-24",
    status: "repaid",
    plan: "bullet",
    installmentCount: 1,
    disbursedAt: "2026-05-10T12:00:00.000Z",
    createdAt: "2026-05-10T12:00:00.000Z"
  }
];

export const demoApplications: LoanApplication[] = [
  {
    id: "e37a7d60-67f6-43cc-bdbc-3dd682674a66",
    studentId: "8a287637-708e-4382-b166-57f2d9b18121",
    amount: 600,
    purpose: "Books and supplies",
    expectedRepaymentDate: "2026-07-15",
    status: "pending_review",
    createdAt: "2026-06-13T12:00:00.000Z"
  },
  {
    id: "5d96af48-c6f8-420a-a52c-c1acb748c2ab",
    studentId: "a902aa44-5c32-463e-8781-94a92b2ec0a9",
    amount: 350,
    purpose: "Transport",
    expectedRepaymentDate: "2026-07-20",
    status: "pending_review",
    createdAt: "2026-06-12T14:00:00.000Z"
  }
];

export const demoAdminDashboard: AdminDashboard = {
  pendingApplications: 2,
  pendingIdVerifications: 3,
  activeLoans: 8,
  repaymentsDue: 4,
  overdueLoans: 1,
  verifiedStudents: 128
};

export const demoStudents = [
  {
    id: "8a287637-708e-4382-b166-57f2d9b18121",
    fullName: "Demo Student",
    email: "demo.student@ub.ac.bw",
    reliability: 72,
    verification: "verified",
    loanCount: 2,
    isBlacklisted: false
  },
  {
    id: "a902aa44-5c32-463e-8781-94a92b2ec0a9",
    fullName: "Sample Borrower",
    email: "sample.borrower@ub.ac.bw",
    reliability: 64,
    verification: "id_pending",
    loanCount: 1,
    isBlacklisted: false
  },
  {
    id: "e9f7b541-7d08-47ea-a8b4-c13c9a88d32a",
    fullName: "Test Applicant",
    email: "test.applicant@buan.ac.bw",
    reliability: 88,
    verification: "verified",
    loanCount: 4,
    isBlacklisted: false
  }
];

function demoUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const next = value === "x" ? random : (random & 0x3) | 0x8;
    return next.toString(16);
  });
}

export function createDemoLoanApplyResult(input: LoanApplyInput): LoanApplyResult {
  const application: LoanApplication = {
    id: demoUuid(),
    studentId: demoUser.id,
    amount: input.amount,
    purpose: input.purpose,
    expectedRepaymentDate: input.expectedRepaymentDate,
    status: "approved",
    createdAt: new Date().toISOString()
  };
  const fee = loanFee(input.amount, defaultTermDays);
  const loan: Loan = {
    id: demoUuid(),
    applicationId: application.id,
    studentId: demoUser.id,
    amount: input.amount,
    fee,
    repaymentAmount: input.amount + fee,
    dueDate: input.expectedRepaymentDate,
    status: "disbursed",
    plan: "bullet",
    installmentCount: 1,
    disbursedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  const repayment: Repayment = {
    id: demoUuid(),
    loanId: loan.id,
    studentId: demoUser.id,
    amount: loan.repaymentAmount,
    dueDate: loan.dueDate,
    paidAt: null,
    status: "scheduled",
    method: null,
    installmentNumber: 1,
    installmentsTotal: 1
  };
  const payment: Payment = {
    id: demoUuid(),
    userId: demoUser.id,
    loanId: loan.id,
    kind: "disbursement",
    amount: loan.amount,
    currency: "BWP",
    provider: "simulated",
    providerRef: `sim_${demoUuid()}`,
    status: "settled",
    createdAt: new Date().toISOString(),
    settledAt: new Date().toISOString()
  };

  return { status: "disbursed", loan, repayment, payment };
}

export function createDemoRepayment(loan: Loan): RepaymentResult {
  const repayment: Repayment = {
    id: demoUuid(),
    loanId: loan.id,
    studentId: loan.studentId,
    amount: loan.repaymentAmount,
    dueDate: loan.dueDate,
    paidAt: new Date().toISOString(),
    status: "paid",
    method: "simulated"
  };
  const payment: Payment = {
    id: demoUuid(),
    userId: loan.studentId,
    loanId: loan.id,
    kind: "repayment",
    amount: loan.repaymentAmount,
    currency: "BWP",
    provider: "simulated",
    providerRef: `sim_${demoUuid()}`,
    status: "settled",
    createdAt: new Date().toISOString(),
    settledAt: new Date().toISOString()
  };
  return { repayment, payment, loanStatus: "repaid" };
}
