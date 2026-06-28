// Single source of truth for every backend route the app talks to.
// Screens must reference these instead of hard-coding raw URL strings, so the
// API surface stays centralized and the client only ever calls our own backend.
export const endpoints = {
  auth: {
    register: "/auth/register",
    login: "/auth/login",
    logout: "/auth/logout",
    verifyEmail: "/auth/verify-email",
    resendVerification: "/auth/resend-verification",
    requestPasswordReset: "/auth/request-password-reset",
    resetPassword: "/auth/reset-password",
    me: "/me"
  },
  account: {
    delete: "/account/delete"
  },
  subscriptions: {
    me: "/subscriptions/me",
    subscribe: "/subscriptions/subscribe",
    cancel: "/subscriptions/cancel"
  },
  institutions: "/institutions",
  student: {
    profile: "/student/profile",
    uploadId: "/student/upload-id",
    dashboard: "/student/dashboard"
  },
  loans: {
    apply: "/loans/apply",
    mine: "/loans/me",
    byId: (id: string) => `/loans/${id}`
  },
  repayments: {
    initiate: "/repayments/initiate",
    mine: "/repayments/me"
  },
  payments: {
    mine: "/payments/me"
  },
  feedback: {
    list: "/feedback",
    create: "/feedback",
    vote: (id: string) => `/feedback/${id}/vote`,
    remove: (id: string) => `/feedback/${id}`
  },
  admin: {
    dashboard: "/admin/dashboard",
    loanApplications: "/admin/loan-applications",
    approve: (id: string) => `/admin/loans/${id}/approve`,
    reject: (id: string) => `/admin/loans/${id}/reject`,
    students: "/admin/students",
    studentById: (id: string) => `/admin/students/${id}`,
    verifyId: (id: string) => `/admin/students/${id}/verify-id`,
    blacklist: (id: string) => `/admin/students/${id}/blacklist`
  }
} as const;
