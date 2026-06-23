import {
  AdminDashboard,
  Dashboard,
  defaultLoanLimits,
  Loan,
  LoanApplication,
  LoanApplyInput,
  LoanApplyResult,
  Repayment,
  User
} from "@pulacash/shared";

export const demoToken = "demo-student-token";
export const demoAdminToken = "demo-admin-token";

export const demoUser: User = {
  id: "8a287637-708e-4382-b166-57f2d9b18121",
  email: "thatayotlhe.tsenang@ub.ac.bw",
  fullName: "Thatayotlhe Tsenang",
  role: "student",
  isBlacklisted: false
};

export const demoDashboard: Dashboard = {
  student: {
    name: demoUser.fullName,
    initials: "TT",
    institution: "University of Botswana",
    verificationStatus: "verified"
  },
  borrowing: {
    available: 600,
    limit: 600,
    activeLoanAmount: 750,
    lastDisbursedAmount: 600,
    nextDueDate: "2026-07-15"
  },
  reliability: {
    score: 72,
    label: "Good"
  },
  nudges: ["Repay on time to unlock higher limits."]
};

export const demoLoans: Loan[] = [
  {
    id: "3b96f4c7-4908-41ac-a65d-53c3dafed80a",
    applicationId: "e37a7d60-67f6-43cc-bdbc-3dd682674a66",
    studentId: "8a287637-708e-4382-b166-57f2d9b18121",
    amount: 600,
    fee: 150,
    repaymentAmount: 750,
    dueDate: "2026-07-15",
    status: "disbursed",
    disbursedAt: "2026-06-13T12:00:00.000Z",
    createdAt: "2026-06-13T12:00:00.000Z"
  },
  {
    id: "71c94799-e1fc-4b1d-99cd-717599219f8e",
    applicationId: "18dff7b8-6555-41e1-9f7b-9e942e8bf585",
    studentId: "8a287637-708e-4382-b166-57f2d9b18121",
    amount: 200,
    fee: 50,
    repaymentAmount: 250,
    dueDate: "2026-05-24",
    status: "repaid",
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
  activeLoans: 8,
  repaymentsDue: 4,
  overdueLoans: 1,
  verifiedStudents: 128
};

export const demoStudents = [
  {
    id: "8a287637-708e-4382-b166-57f2d9b18121",
    fullName: "Thatayotlhe Tsenang",
    email: "thatayotlhe.tsenang@ub.ac.bw",
    reliability: 72,
    verification: "verified",
    loanCount: 2,
    isBlacklisted: false
  },
  {
    id: "a902aa44-5c32-463e-8781-94a92b2ec0a9",
    fullName: "Molefe Thato",
    email: "thato.molefe@ub.ac.bw",
    reliability: 64,
    verification: "id_pending",
    loanCount: 1,
    isBlacklisted: false
  },
  {
    id: "e9f7b541-7d08-47ea-a8b4-c13c9a88d32a",
    fullName: "Naledi Moremi",
    email: "naledi.moremi@buan.ac.bw",
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
  const fee = Math.round(input.amount * defaultLoanLimits.feeRate);
  const loan: Loan = {
    id: demoUuid(),
    applicationId: application.id,
    studentId: demoUser.id,
    amount: input.amount,
    fee,
    repaymentAmount: input.amount + fee,
    dueDate: input.expectedRepaymentDate,
    status: "disbursed",
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
    method: null
  };

  return { status: "disbursed", loan, repayment };
}

export function createDemoRepayment(loan: Loan): Repayment {
  return {
    id: demoUuid(),
    loanId: loan.id,
    studentId: loan.studentId,
    amount: loan.repaymentAmount,
    dueDate: loan.dueDate,
    paidAt: new Date().toISOString(),
    status: "paid",
    method: "manual_bank_transfer"
  };
}
