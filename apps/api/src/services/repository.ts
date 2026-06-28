import {
  AdminDashboard,
  allowedInstitutionDomains,
  BlacklistStudentInput,
  Dashboard,
  defaultLoanLimits,
  Feedback,
  FeedbackCategory,
  FeedbackCreateInput,
  installmentSchedule,
  installmentTermDays,
  Loan,
  LoanApplication,
  LoanApplyInput,
  LoanApplyResult,
  loanFee,
  membership,
  Payment,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  Repayment,
  RepaymentPlan,
  RepaymentResult,
  scoreBandFor,
  StudentProfileInput,
  SubscriptionTier,
  tierLimit,
  User,
  VerificationStatus
} from "@pulacash/shared";
import type { FastifyBaseLogger } from "fastify";
import { createDb, type SqliteDb } from "../db/client.js";
import { adminCredentials, env, isProd, sessionTtlMs } from "../env.js";
import { generateVerificationCode, hashPassword, hashToken, issueSessionToken, verifyPassword } from "../lib/password.js";
import { getPaymentProvider, type PaymentInstruction } from "./payments.js";

type Institution = {
  id: string;
  name: string;
  emailDomain: string;
};

type StudentProfile = StudentProfileInput & {
  userId: string;
  idStatus: VerificationStatus;
  idDocumentPath?: string;
};

type ReliabilityScore = {
  studentId: string;
  score: number;
  onTimeRepayments: number;
  lateRepayments: number;
};

type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type FeedbackRecord = {
  id: string;
  userId: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string;
};

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const id = () => crypto.randomUUID();
const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / (24 * 60 * 60 * 1000));

// Email-verification and password-reset codes are short-lived and rate-limited.
const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFICATION_ATTEMPTS = 5;

type SessionRecord = { userId: string; expiresAt: number };
type VerificationRecord = { code: string; expiresAt: number; attempts: number };

/**
 * In-memory working set backed by SQLite. The Maps keep reads simple and fast;
 * every mutation is written through to SQLite so state survives a restart. On
 * boot we load existing rows back into the Maps, seeding demo data only when the
 * database is empty.
 */
export class PulaCashRepository {
  private db: SqliteDb;
  private users = new Map<string, User>();
  private usersByEmail = new Map<string, string>();
  // Bearer sessions keyed by the SHA-256 hash of the token (never the raw token).
  private tokens = new Map<string, SessionRecord>();
  // Password hashes, kept out of the User contract so they never reach a response.
  private passwordByUser = new Map<string, string>();
  private institutions = new Map<string, Institution>();
  private profiles = new Map<string, StudentProfile>();
  private applications = new Map<string, LoanApplication>();
  private loans = new Map<string, Loan>();
  private repayments = new Map<string, Repayment>();
  private scores = new Map<string, ReliabilityScore>();
  private payments = new Map<string, Payment>();
  private paymentsByRef = new Map<string, string>();
  private feedback = new Map<string, FeedbackRecord>();
  private feedbackVotes = new Map<string, Set<string>>();
  private auditLogs: AuditLog[] = [];
  // Ephemeral email-verification + password-reset codes (userId -> code + expiry +
  // attempts). Short-lived by nature, so not persisted across restarts.
  private verificationCodes = new Map<string, VerificationRecord>();
  private resetCodes = new Map<string, VerificationRecord>();
  private seeded = false;

  constructor(db: SqliteDb = createDb()) {
    this.db = db;
    this.load();
  }

  /**
   * Seed first-boot data (admin + dev fixtures). Async because hashing the admin
   * password is async; call once before the app starts serving requests.
   */
  async ready(): Promise<this> {
    if (!this.seeded && this.users.size === 0) {
      await this.seed();
    }
    this.seeded = true;
    return this;
  }

  listInstitutions() {
    return [...this.institutions.values()];
  }

  getUserByToken(token: string | undefined) {
    if (!token) return null;
    const hash = hashToken(token);
    const session = this.tokens.get(hash);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.revokeTokenHash(hash);
      return null;
    }
    return this.users.get(session.userId) ?? null;
  }

  /** Issue a fresh opaque session token for a user and persist only its hash. */
  private startSession(userId: string): string {
    const { token, tokenHash } = issueSessionToken();
    const expiresAt = Date.now() + sessionTtlMs;
    this.tokens.set(tokenHash, { userId, expiresAt });
    this.persistToken(tokenHash, userId, expiresAt);
    return token;
  }

  private revokeTokenHash(hash: string) {
    this.tokens.delete(hash);
    this.db.prepare("DELETE FROM auth_tokens WHERE token = ?").run(hash);
  }

  /** Revoke every session for a user (used on password reset and account deletion). */
  private revokeAllSessions(userId: string) {
    for (const [hash, session] of this.tokens) {
      if (session.userId === userId) this.tokens.delete(hash);
    }
    this.db.prepare("DELETE FROM auth_tokens WHERE user_id = ?").run(userId);
  }

  /** Revoke the caller's bearer token (logout). No-op for an unknown token. */
  logout(token: string | undefined) {
    if (!token) return { ok: true };
    this.revokeTokenHash(hashToken(token));
    return { ok: true };
  }

  async register(input: { email: string; fullName: string; password: string }) {
    const email = input.email.toLowerCase();
    if (this.usersByEmail.has(email)) {
      throw new RepositoryError(409, "A PulaCash account already exists for this student email.");
    }

    const user: User = {
      id: id(),
      email,
      fullName: input.fullName,
      role: "student",
      isBlacklisted: false,
      emailVerified: false,
      subscriptionTier: "free",
      subscriptionRenewsAt: null,
      freeLoansUsed: 0
    };
    const passwordHash = await hashPassword(input.password);
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    this.passwordByUser.set(user.id, passwordHash);
    const score: ReliabilityScore = {
      studentId: user.id,
      score: defaultLoanLimits.defaultScore,
      onTimeRepayments: 0,
      lateRepayments: 0
    };
    this.scores.set(user.id, score);

    this.persistUser(user);
    this.persistScore(score);

    const token = this.startSession(user.id);
    const verificationCode = this.issueVerificationCode(user.id);

    return { token, user, verificationCode };
  }

  async login(email: string, password: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    const user = userId ? this.users.get(userId) : undefined;
    // Always run the (expensive) verification so a missing account and a wrong
    // password take indistinguishable time, and never reveal which one failed.
    const ok = await verifyPassword(password, userId ? this.passwordByUser.get(userId) : undefined);
    if (!user || !ok) throw new RepositoryError(401, "Invalid email or password.");

    const token = this.startSession(user.id);
    return { token, user };
  }

  private issueVerificationCode(userId: string): string {
    const code = generateVerificationCode();
    this.verificationCodes.set(userId, { code, expiresAt: Date.now() + VERIFICATION_TTL_MS, attempts: 0 });
    return code;
  }

  /** Re-issue a verification code for the signed-in user (resend flow). */
  resendVerification(user: User) {
    if (user.emailVerified) throw new RepositoryError(409, "This email is already verified.");
    return this.issueVerificationCode(user.id);
  }

  verifyEmail(email: string, code: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    const record = userId ? this.verificationCodes.get(userId) : undefined;
    // Generic error everywhere so this can't be used to probe which emails exist.
    const invalid = () => new RepositoryError(400, "That verification code is invalid or has expired.");
    if (!userId || !record) throw invalid();
    if (Date.now() > record.expiresAt) {
      this.verificationCodes.delete(userId);
      throw invalid();
    }
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      this.verificationCodes.delete(userId);
      throw new RepositoryError(429, "Too many attempts. Request a new verification code.");
    }
    if (record.code !== code) {
      record.attempts += 1;
      throw invalid();
    }

    this.verificationCodes.delete(userId);
    const user = this.users.get(userId);
    if (user && !user.emailVerified) {
      const next: User = { ...user, emailVerified: true };
      this.users.set(userId, next);
      this.persistUser(next);
    }
    const profile = this.profiles.get(userId);
    if (profile && profile.idStatus === "email_pending") {
      const next = { ...profile, idStatus: "email_verified" as VerificationStatus };
      this.profiles.set(userId, next);
      this.persistProfile(next);
    }
    return { verified: true };
  }

  /**
   * Begin a password reset. Returns the code only when the account exists, so the
   * route can email it; callers always respond 200 regardless, avoiding enumeration.
   */
  requestPasswordReset(email: string): { code: string; user: User } | null {
    const userId = this.usersByEmail.get(email.toLowerCase());
    const user = userId ? this.users.get(userId) : undefined;
    if (!userId || !user) return null;
    const code = generateVerificationCode();
    this.resetCodes.set(userId, { code, expiresAt: Date.now() + VERIFICATION_TTL_MS, attempts: 0 });
    return { code, user };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    const record = userId ? this.resetCodes.get(userId) : undefined;
    const invalid = () => new RepositoryError(400, "That reset code is invalid or has expired.");
    if (!userId || !record) throw invalid();
    if (Date.now() > record.expiresAt) {
      this.resetCodes.delete(userId);
      throw invalid();
    }
    if (record.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      this.resetCodes.delete(userId);
      throw new RepositoryError(429, "Too many attempts. Request a new reset code.");
    }
    if (record.code !== code) {
      record.attempts += 1;
      throw invalid();
    }

    const user = this.users.get(userId)!;
    this.resetCodes.delete(userId);
    this.passwordByUser.set(userId, await hashPassword(newPassword));
    this.persistUser(user);
    // Invalidate every existing session so a leaked token can't outlive the reset.
    this.revokeAllSessions(userId);
    return { ok: true };
  }

  /**
   * In-app account deletion (App Store Guideline 5.1.1(v)). Requires the current
   * password. PII is erased/anonymised and sessions revoked; financial records are
   * retained (anonymised) to meet lending/audit obligations.
   */
  async deleteAccount(user: User, password: string) {
    if (user.role === "admin") throw new RepositoryError(403, "The admin account cannot be deleted in-app.");
    const ok = await verifyPassword(password, this.passwordByUser.get(user.id));
    if (!ok) throw new RepositoryError(401, "Password is incorrect.");

    // Drop the credential and all sessions so the account can never be used again.
    this.passwordByUser.delete(user.id);
    this.db.prepare("UPDATE users SET password_hash = NULL WHERE id = ?").run(user.id);
    this.revokeAllSessions(user.id);

    // Remove the student profile (PII + ID document path).
    this.profiles.delete(user.id);
    this.db.prepare("DELETE FROM student_profiles WHERE user_id = ?").run(user.id);

    // Anonymise the user row (keep it so retained loans/payments stay referentially
    // intact, but strip name/email and free the email for re-registration).
    this.usersByEmail.delete(user.email);
    const anonymised: User = {
      ...user,
      email: `deleted+${user.id}@pulacash.invalid`,
      fullName: "Deleted account",
      subscriptionTier: "free",
      subscriptionRenewsAt: null
    };
    this.users.set(user.id, anonymised);
    this.usersByEmail.set(anonymised.email, user.id);
    this.db
      .prepare("UPDATE users SET email = ?, full_name = ?, subscription_tier = 'free', subscription_renews_at = NULL, deleted_at = ? WHERE id = ?")
      .run(anonymised.email, anonymised.fullName, now(), user.id);

    return { ok: true };
  }

  upsertProfile(user: User, input: StudentProfileInput) {
    this.ensureStudent(user);
    // First factor: the student email must be confirmed before a profile exists.
    if (!user.emailVerified) {
      throw new RepositoryError(403, "Verify your student email before completing your profile.");
    }
    const duplicate = [...this.profiles.values()].find(
      (profile) => profile.studentNumber === input.studentNumber && profile.userId !== user.id
    );
    if (duplicate) throw new RepositoryError(409, "This student ID number is already linked to another account.");

    // Preserve an already-verified ID status on edit; otherwise the profile starts
    // at email_verified (email done, ID document not yet reviewed).
    const existing = this.profiles.get(user.id);
    const idStatus: VerificationStatus =
      existing && (existing.idStatus === "verified" || existing.idStatus === "id_pending")
        ? existing.idStatus
        : "email_verified";
    const profile: StudentProfile = {
      ...input,
      userId: user.id,
      idStatus,
      idDocumentPath: existing?.idDocumentPath
    };
    this.profiles.set(user.id, profile);
    this.persistProfile(profile);
    return profile;
  }

  /** Record that a student ID document was uploaded (path comes from the storage service). */
  recordIdUpload(user: User, documentPath: string) {
    this.ensureStudent(user);
    const profile = this.requireProfile(user.id);
    const nextProfile: StudentProfile = {
      ...profile,
      idStatus: "id_pending",
      idDocumentPath: documentPath
    };
    this.profiles.set(user.id, nextProfile);
    this.persistProfile(nextProfile);
    return nextProfile.idStatus;
  }

  getDashboard(user: User): Dashboard {
    this.ensureStudent(user);
    const profile = this.requireProfile(user.id);
    const institution = this.institutions.get(profile.institutionId);
    const score = this.scores.get(user.id)?.score ?? defaultLoanLimits.defaultScore;
    const scoreBand = scoreBandFor(score);
    const activeLoan = [...this.loans.values()].find(
      (loan) => loan.studentId === user.id && loan.status !== "repaid" && loan.status !== "rejected"
    );
    const limit = tierLimit(user.subscriptionTier);

    return {
      student: {
        name: user.fullName,
        initials: initials(user.fullName),
        institution: institution?.name ?? "Student institution",
        verificationStatus: profile.idStatus
      },
      borrowing: {
        available: activeLoan ? 0 : limit,
        limit,
        activeLoanAmount: activeLoan?.repaymentAmount ?? null,
        lastDisbursedAmount: activeLoan?.disbursedAt ? activeLoan.amount : null,
        nextDueDate: activeLoan?.dueDate ?? null
      },
      reliability: {
        score,
        label: scoreBand.label
      },
      membership: {
        tier: user.subscriptionTier,
        renewsAt: user.subscriptionRenewsAt,
        limit,
        freeLoansRemaining: freeLoansRemaining(user)
      },
      nudges:
        user.subscriptionTier === "plus"
          ? ["Use a monthly installment plan on larger loans.", "Repay on time to keep building your score."]
          : freeLoansRemaining(user) > 0
            ? ["Your first PulaCash loan is free to start — up to P300.", "Repay on time to build your score."]
            : ["You've used your free loan — join PulaCash+ to keep borrowing up to P2,000.", "Members get instant payout + installment plans."]
    };
  }

  async applyForLoan(user: User, input: LoanApplyInput, log: FastifyBaseLogger): Promise<LoanApplyResult> {
    this.ensureStudent(user);
    if (user.isBlacklisted) throw new RepositoryError(403, "This account is not eligible for new loans.");
    const profile = this.requireProfile(user.id);
    // Two-factor identity gate: a confirmed student email *and* a reviewed student
    // ID (status `verified`) are both required before any money can move.
    if (!user.emailVerified) {
      throw new RepositoryError(403, "Verify your student email before applying for a loan.");
    }
    if (profile.idStatus !== "verified") {
      throw new RepositoryError(403, "Your student ID must be verified before you can borrow.");
    }

    // Free-tier funnel: once the free loan allowance is spent, PulaCash+ is required.
    if (user.subscriptionTier !== "plus" && freeLoansRemaining(user) <= 0) {
      throw new RepositoryError(403, "You've used your free PulaCash loan. Join PulaCash+ to keep borrowing.");
    }

    // Tier ceiling: free borrowers up to P300, PulaCash+ up to P2,000.
    const limit = tierLimit(user.subscriptionTier);
    if (input.amount > limit) {
      throw new RepositoryError(
        403,
        user.subscriptionTier === "plus"
          ? `The maximum loan is P${limit}.`
          : `Free accounts can borrow up to P${limit}. Upgrade to PulaCash+ to borrow up to P${defaultLoanLimits.plusTierLimit}.`
      );
    }

    const plan: RepaymentPlan = input.repaymentPlan ?? "bullet";
    let term: number;
    let installmentCount = 1;

    if (plan === "installment") {
      // Monthly installment plans are a PulaCash+ feature for larger loans.
      if (user.subscriptionTier !== "plus") {
        throw new RepositoryError(403, "Monthly installment plans are a PulaCash+ feature.");
      }
      if (input.amount < defaultLoanLimits.installmentMinAmount) {
        throw new RepositoryError(400, `Installment plans are available on loans of P${defaultLoanLimits.installmentMinAmount} or more.`);
      }
      installmentCount = input.installments ?? 3;
      if (!(defaultLoanLimits.installmentCounts as readonly number[]).includes(installmentCount)) {
        throw new RepositoryError(400, "Choose 2, 3, or 4 monthly installments.");
      }
      // Term/schedule are derived server-side; the client's date is ignored here.
      term = installmentTermDays(installmentCount);
    } else {
      // Bullet loan: a single repayment on a client-chosen date within the term bounds.
      term = daysBetween(today(), input.expectedRepaymentDate);
      if (term < defaultLoanLimits.minTermDays) {
        throw new RepositoryError(400, `Choose a repayment date at least ${defaultLoanLimits.minTermDays} days away.`);
      }
      if (term > defaultLoanLimits.maxBulletTermDays) {
        throw new RepositoryError(400, `A single-repayment loan can be at most ${defaultLoanLimits.maxBulletTermDays} days. Use an installment plan for longer.`);
      }
    }

    const activeLoan = [...this.loans.values()].some(
      (loan) => loan.studentId === user.id && !["repaid", "rejected"].includes(loan.status)
    );
    if (activeLoan) throw new RepositoryError(409, "Repay your active loan before applying again.");

    const dueDate = new Date(Date.now() + term * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const instant = input.amount <= defaultLoanLimits.autoApproveThreshold;
    const application: LoanApplication = {
      id: id(),
      studentId: user.id,
      amount: input.amount,
      purpose: input.purpose,
      // Final due date is server-computed (= now + term) so it always matches the plan.
      expectedRepaymentDate: dueDate,
      status: instant ? "approved" : "pending_review",
      createdAt: now()
    };
    this.applications.set(application.id, application);
    this.persistApplication(application);

    if (instant) {
      const { loan, repayment, payment } = await this.disburseApplication(
        application,
        { method: input.disbursementMethod, plan, installmentCount, termDays: term },
        log
      );
      // A free-tier borrow consumes one free-loan allowance.
      if (user.subscriptionTier !== "plus") this.consumeFreeLoan(user);
      this.log(user, "loan.auto_disburse", "loan", loan.id, { amount: loan.amount, plan, paymentId: payment.id });
      return { status: "disbursed", loan, repayment, payment };
    }

    return { status: "pending_review", application };
  }

  private consumeFreeLoan(user: User) {
    const next: User = { ...user, freeLoansUsed: user.freeLoansUsed + 1 };
    this.users.set(user.id, next);
    this.persistUser(next);
  }

  listMyLoans(user: User) {
    this.ensureStudent(user);
    return [...this.loans.values()].filter((loan) => loan.studentId === user.id);
  }

  getLoanForUser(user: User, loanId: string) {
    const loan = this.loans.get(loanId);
    if (!loan) throw new RepositoryError(404, "Loan not found.");
    if (user.role !== "admin" && loan.studentId !== user.id) throw new RepositoryError(403, "Not allowed.");
    return loan;
  }

  async initiateRepayment(user: User, loanId: string, method: PaymentMethod, log: FastifyBaseLogger): Promise<RepaymentResult> {
    this.ensureStudent(user);
    const loan = this.getLoanForUser(user, loanId);
    if (loan.status === "repaid") throw new RepositoryError(409, "This loan is already repaid.");
    if (loan.status !== "disbursed") throw new RepositoryError(409, "This loan is not ready for repayment yet.");

    // Don't allow a second charge while one is still in flight (matters for the
    // async http provider; the simulated provider settles synchronously).
    const inFlight = [...this.payments.values()].some(
      (payment) => payment.loanId === loan.id && payment.kind === "repayment" && payment.status === "pending"
    );
    if (inFlight) throw new RepositoryError(409, "A repayment for this loan is already being processed.");

    // Charge the next unpaid installment — the amount is computed from the loan's
    // own schedule, never trusted from the client.
    const installment = this.nextUnpaidInstallment(loan.id);
    if (!installment) throw new RepositoryError(409, "There is nothing left to repay on this loan.");

    const profile = this.profiles.get(user.id);
    const payment = await this.createPayment(
      { user, kind: "repayment", amount: installment.amount, loanId: loan.id, method, account: profile?.phoneNumber },
      log
    );

    if (payment.status === "settled") {
      this.settleInstallment(loan, installment, payment);
    }

    const repayment = this.repayments.get(installment.id) ?? installment;
    const current = this.loans.get(loan.id) ?? loan;
    return { repayment, payment, loanStatus: current.status };
  }

  listMyPayments(user: User) {
    this.ensureStudent(user);
    return [...this.payments.values()]
      .filter((payment) => payment.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listMyRepayments(user: User) {
    this.ensureStudent(user);
    return [...this.repayments.values()].filter((repayment) => repayment.studentId === user.id);
  }

  getAdminDashboard(user: User): AdminDashboard {
    this.ensureAdmin(user);
    return {
      pendingApplications: [...this.applications.values()].filter((application) => application.status === "pending_review")
        .length,
      pendingIdVerifications: [...this.profiles.values()].filter((profile) => profile.idStatus === "id_pending").length,
      activeLoans: [...this.loans.values()].filter((loan) => !["repaid", "rejected"].includes(loan.status)).length,
      repaymentsDue: [...this.repayments.values()].filter((repayment) => repayment.status === "due").length,
      overdueLoans: [...this.repayments.values()].filter((repayment) => repayment.status === "overdue").length,
      verifiedStudents: [...this.profiles.values()].filter((profile) => profile.idStatus === "verified").length
    };
  }

  listLoanApplications(user: User) {
    this.ensureAdmin(user);
    return [...this.applications.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((application) => ({
        ...application,
        student: this.users.get(application.studentId),
        reliability: this.scores.get(application.studentId)?.score ?? defaultLoanLimits.defaultScore
      }));
  }

  async approveLoan(user: User, applicationId: string, log: FastifyBaseLogger) {
    this.ensureAdmin(user);
    const application = this.requireApplication(applicationId);
    if (application.status !== "pending_review") throw new RepositoryError(409, "Application was already reviewed.");

    const approved = { ...application, status: "approved" as const };
    this.applications.set(application.id, approved);
    this.persistApplication(approved);

    const { loan, repayment, payment } = await this.disburseApplication(approved, undefined, log);
    this.log(user, "loan.approve", "loan_application", application.id, { loanId: loan.id, paymentId: payment.id });
    return { application: approved, loan, repayment, payment };
  }

  rejectLoan(user: User, applicationId: string, reason?: string) {
    this.ensureAdmin(user);
    const application = this.requireApplication(applicationId);
    if (application.status !== "pending_review") throw new RepositoryError(409, "Application was already reviewed.");
    const rejected = { ...application, status: "rejected" as const, decisionReason: reason ?? "Not eligible right now." };
    this.applications.set(application.id, rejected);
    this.persistApplication(rejected);
    this.log(user, "loan.reject", "loan_application", application.id, { reason: rejected.decisionReason });
    return rejected;
  }

  listStudents(user: User, query?: string) {
    this.ensureAdmin(user);
    const normalized = query?.toLowerCase();
    return [...this.users.values()]
      .filter((candidate) => candidate.role === "student")
      .filter((candidate) => {
        if (!normalized) return true;
        return candidate.fullName.toLowerCase().includes(normalized) || candidate.email.includes(normalized);
      })
      .map((student) => this.studentSummary(student.id));
  }

  getStudent(user: User, studentId: string) {
    this.ensureAdmin(user);
    return this.studentSummary(studentId);
  }

  /**
   * Admin decision on an uploaded student ID (the KYC step). Approving moves the
   * student to `verified` — the only status that unlocks borrowing.
   */
  verifyStudentId(user: User, studentId: string, approved: boolean, reason?: string) {
    this.ensureAdmin(user);
    const profile = this.profiles.get(studentId);
    if (!profile) throw new RepositoryError(404, "Student profile not found.");
    if (profile.idStatus !== "id_pending") {
      throw new RepositoryError(409, "There is no pending ID document to review for this student.");
    }
    const idStatus: VerificationStatus = approved ? "verified" : "rejected";
    const next: StudentProfile = { ...profile, idStatus };
    this.profiles.set(studentId, next);
    this.persistProfile(next);
    this.log(user, approved ? "student.id_verified" : "student.id_rejected", "user", studentId, { reason });
    return this.studentSummary(studentId);
  }

  blacklistStudent(user: User, studentId: string, input: BlacklistStudentInput) {
    this.ensureAdmin(user);
    const student = this.users.get(studentId);
    if (!student || student.role !== "student") throw new RepositoryError(404, "Student not found.");
    const updated: User = { ...student, isBlacklisted: input.blacklisted };
    this.users.set(student.id, updated);
    this.persistUser(updated);
    this.log(user, input.blacklisted ? "student.blacklist" : "student.unblacklist", "user", student.id, {
      reason: input.reason
    });
    return this.studentSummary(student.id);
  }

  /**
   * Disburse an approved application through the payment rails. The loan is marked
   * `disbursed` only when the payout settles synchronously (simulated provider);
   * with a real provider it stays `approved` until the settlement webhook arrives.
   */
  private async disburseApplication(
    application: LoanApplication,
    options: { method?: PaymentMethod; plan?: RepaymentPlan; installmentCount?: number; termDays?: number } = {},
    log: FastifyBaseLogger
  ): Promise<{ loan: Loan; repayment: Repayment; payment: Payment }> {
    const student = this.users.get(application.studentId)!;
    const profile = this.profiles.get(application.studentId);
    const plan: RepaymentPlan = options.plan ?? "bullet";
    const installmentCount = plan === "installment" ? options.installmentCount ?? 3 : 1;
    // Fee scales with the term (server is the source of truth for the term).
    const termDays = options.termDays ?? Math.max(defaultLoanLimits.minTermDays, daysBetween(today(), application.expectedRepaymentDate));
    const fee = loanFee(application.amount, termDays);
    const loanId = id();

    const payment = await this.createPayment(
      {
        user: student,
        kind: "disbursement",
        amount: application.amount,
        loanId,
        method: options.method ?? "orange_money",
        account: profile?.phoneNumber
      },
      log
    );
    const settled = payment.status === "settled";

    const loan: Loan = {
      id: loanId,
      applicationId: application.id,
      studentId: application.studentId,
      amount: application.amount,
      fee,
      repaymentAmount: application.amount + fee,
      dueDate: application.expectedRepaymentDate,
      status: settled ? "disbursed" : "approved",
      plan,
      installmentCount,
      disbursedAt: settled ? now() : null,
      createdAt: now()
    };
    this.loans.set(loan.id, loan);
    this.persistLoan(loan);

    const schedule = this.buildSchedule(loan);
    return { loan, repayment: schedule[0]!, payment };
  }

  /** Generate the repayment schedule for a loan (1 row for bullet, N for installment). */
  private buildSchedule(loan: Loan): Repayment[] {
    const count = loan.plan === "installment" ? Math.max(2, loan.installmentCount) : 1;
    const rows: Repayment[] = [];
    if (count === 1) {
      const r: Repayment = {
        id: id(),
        loanId: loan.id,
        studentId: loan.studentId,
        amount: loan.repaymentAmount,
        dueDate: loan.dueDate,
        paidAt: null,
        status: loan.dueDate <= today() ? "due" : "scheduled",
        method: null,
        installmentNumber: 1,
        installmentsTotal: 1
      };
      this.repayments.set(r.id, r);
      this.persistRepayment(r);
      return [r];
    }
    const amounts = installmentSchedule(loan.repaymentAmount, count);
    const start = Date.now();
    for (let i = 0; i < count; i += 1) {
      const dueDate = new Date(start + (i + 1) * defaultLoanLimits.installmentPeriodDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const r: Repayment = {
        id: id(),
        loanId: loan.id,
        studentId: loan.studentId,
        amount: amounts[i]!,
        dueDate,
        paidAt: null,
        status: i === 0 && dueDate <= today() ? "due" : "scheduled",
        method: null,
        installmentNumber: i + 1,
        installmentsTotal: count
      };
      this.repayments.set(r.id, r);
      this.persistRepayment(r);
      rows.push(r);
    }
    return rows;
  }

  // --- Payments & settlement ---

  /** Create a payment, push it to the provider, and record the resulting status. */
  private async createPayment(
    args: { user: User; kind: PaymentKind; amount: number; loanId?: string | null; method: PaymentMethod; account?: string },
    log: FastifyBaseLogger
  ): Promise<Payment> {
    const provider = getPaymentProvider();
    const payment: Payment = {
      id: id(),
      userId: args.user.id,
      loanId: args.loanId ?? null,
      kind: args.kind,
      amount: args.amount,
      currency: env.PAYMENT_CURRENCY,
      provider: provider.name,
      providerRef: "",
      status: "pending",
      createdAt: now(),
      settledAt: null
    };

    const instruction: PaymentInstruction = {
      kind: args.kind,
      amount: args.amount,
      currency: payment.currency,
      reference: payment.id,
      method: args.method,
      account: args.account
    };

    try {
      const result = await provider.createPayment(instruction, log);
      payment.providerRef = result.providerRef;
      payment.status = result.status;
      if (result.status === "settled") payment.settledAt = now();
    } catch (err) {
      payment.status = "failed";
      payment.providerRef = `failed_${payment.id}`;
      this.savePayment(payment);
      throw new RepositoryError(502, "Payment could not be processed. Please try again.");
    }
    this.savePayment(payment);
    return payment;
  }

  /**
   * Apply a settled payment to its target (webhook + synchronous paths both call
   * this). Idempotent on already-settled payments.
   */
  settlePayment(providerRef: string, status: "settled" | "failed"): { ok: boolean } {
    const paymentId = this.paymentsByRef.get(providerRef);
    const payment = paymentId ? this.payments.get(paymentId) : undefined;
    if (!payment) return { ok: false };
    if (payment.status === "settled") return { ok: true };

    const updated: Payment = { ...payment, status, settledAt: status === "settled" ? now() : payment.settledAt };
    this.savePayment(updated);
    if (status !== "settled") return { ok: true };

    if (payment.kind === "disbursement" && payment.loanId) {
      const loan = this.loans.get(payment.loanId);
      if (loan && loan.status === "approved") {
        const disbursed: Loan = { ...loan, status: "disbursed", disbursedAt: now() };
        this.loans.set(loan.id, disbursed);
        this.persistLoan(disbursed);
      }
    } else if (payment.kind === "repayment" && payment.loanId) {
      const loan = this.loans.get(payment.loanId);
      const installment = this.nextUnpaidInstallment(payment.loanId);
      if (loan && installment && loan.status !== "repaid") this.settleInstallment(loan, installment, updated);
    } else if (payment.kind === "subscription") {
      const user = this.users.get(payment.userId);
      if (user) this.activatePlus(user);
    }
    return { ok: true };
  }

  /** The earliest unpaid installment for a loan (lowest installment number). */
  private nextUnpaidInstallment(loanId: string): Repayment | undefined {
    return [...this.repayments.values()]
      .filter((repayment) => repayment.loanId === loanId && repayment.status !== "paid")
      .sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1))[0];
  }

  /** Mark one installment paid; if it was the last, close the loan and score it. */
  private settleInstallment(loan: Loan, installment: Repayment, payment: Payment) {
    const paid: Repayment = { ...installment, status: "paid", paidAt: now(), method: payment.provider };
    this.repayments.set(paid.id, paid);
    this.persistRepayment(paid);

    // Recompute after marking this one paid: if nothing is left, the loan is repaid.
    if (!this.nextUnpaidInstallment(loan.id)) {
      const repaidLoan: Loan = { ...loan, status: "repaid" };
      this.loans.set(loan.id, repaidLoan);
      this.persistLoan(repaidLoan);
      const onTime = today() <= installment.dueDate;
      this.updateScoreAfterRepayment(loan.studentId, onTime);
    }
  }

  private savePayment(payment: Payment) {
    this.payments.set(payment.id, payment);
    this.paymentsByRef.set(payment.providerRef, payment.id);
    this.persistPayment(payment);
  }

  // --- Subscriptions (the PulaCash+ membership) ---

  async subscribe(user: User, paymentMethod: PaymentMethod, log: FastifyBaseLogger) {
    this.ensureStudent(user);
    if (user.subscriptionTier === "plus") throw new RepositoryError(409, "You're already on PulaCash+.");
    const payment = await this.createPayment(
      { user, kind: "subscription", amount: membership.plus.priceBwp, method: paymentMethod },
      log
    );
    const updated = payment.status === "settled" ? this.activatePlus(user) : user;
    this.log(user, "subscription.subscribe", "user", user.id, { paymentId: payment.id, status: payment.status });
    return { user: updated, payment };
  }

  cancelSubscription(user: User) {
    this.ensureStudent(user);
    const next: User = { ...user, subscriptionTier: "free", subscriptionRenewsAt: null };
    this.users.set(user.id, next);
    this.persistUser(next);
    this.log(user, "subscription.cancel", "user", user.id, {});
    return next;
  }

  private activatePlus(user: User): User {
    const renewsAt = new Date(Date.now() + membership.plus.periodDays * 24 * 60 * 60 * 1000).toISOString();
    const next: User = { ...user, subscriptionTier: "plus", subscriptionRenewsAt: renewsAt };
    this.users.set(user.id, next);
    this.persistUser(next);
    return next;
  }

  // --- Feedback board ---

  createFeedback(user: User, input: FeedbackCreateInput): Feedback {
    const record: FeedbackRecord = {
      id: id(),
      userId: user.id,
      category: input.category,
      message: input.message,
      createdAt: now()
    };
    this.feedback.set(record.id, record);
    this.feedbackVotes.set(record.id, new Set());
    this.persistFeedback(record);
    return this.feedbackView(record, user);
  }

  listFeedback(user: User): Feedback[] {
    return [...this.feedback.values()]
      .map((record) => this.feedbackView(record, user))
      .sort((a, b) => b.voteCount - a.voteCount || b.createdAt.localeCompare(a.createdAt));
  }

  toggleFeedbackVote(user: User, feedbackId: string): Feedback {
    const record = this.feedback.get(feedbackId);
    if (!record) throw new RepositoryError(404, "Feedback not found.");
    const votes = this.feedbackVotes.get(feedbackId) ?? new Set<string>();
    if (votes.has(user.id)) {
      votes.delete(user.id);
      this.db.prepare("DELETE FROM feedback_votes WHERE feedback_id = ? AND user_id = ?").run(feedbackId, user.id);
    } else {
      votes.add(user.id);
      this.db.prepare("INSERT OR IGNORE INTO feedback_votes (feedback_id, user_id) VALUES (?, ?)").run(feedbackId, user.id);
    }
    this.feedbackVotes.set(feedbackId, votes);
    return this.feedbackView(record, user);
  }

  deleteFeedback(user: User, feedbackId: string) {
    const record = this.feedback.get(feedbackId);
    if (!record) throw new RepositoryError(404, "Feedback not found.");
    // Only the author (or an admin) may delete a post.
    if (record.userId !== user.id && user.role !== "admin") throw new RepositoryError(403, "Not allowed.");
    this.feedback.delete(feedbackId);
    this.feedbackVotes.delete(feedbackId);
    this.db.prepare("DELETE FROM feedback WHERE id = ?").run(feedbackId);
    this.db.prepare("DELETE FROM feedback_votes WHERE feedback_id = ?").run(feedbackId);
    return { ok: true };
  }

  private feedbackView(record: FeedbackRecord, viewer: User): Feedback {
    const votes = this.feedbackVotes.get(record.id) ?? new Set<string>();
    const author = this.users.get(record.userId);
    return {
      id: record.id,
      category: record.category,
      message: record.message,
      // First name only — never expose another user's full name, email, or id.
      authorName: author ? firstName(author.fullName) : "Student",
      createdAt: record.createdAt,
      voteCount: votes.size,
      hasVoted: votes.has(viewer.id),
      isMine: record.userId === viewer.id
    };
  }

  private persistFeedback(record: FeedbackRecord) {
    this.db
      .prepare("INSERT OR REPLACE INTO feedback (id, user_id, category, message, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(record.id, record.userId, record.category, record.message, record.createdAt);
  }

  private studentSummary(studentId: string) {
    const student = this.users.get(studentId);
    if (!student) throw new RepositoryError(404, "Student not found.");
    return {
      ...student,
      profile: this.profiles.get(student.id) ?? null,
      reliability: this.scores.get(student.id) ?? null,
      loans: [...this.loans.values()].filter((loan) => loan.studentId === student.id),
      applications: [...this.applications.values()].filter((application) => application.studentId === student.id)
    };
  }

  private requireProfile(userId: string) {
    const profile = this.profiles.get(userId);
    if (!profile) throw new RepositoryError(403, "Create a student profile before continuing.");
    return profile;
  }

  private requireApplication(applicationId: string) {
    const application = this.applications.get(applicationId);
    if (!application) throw new RepositoryError(404, "Loan application not found.");
    return application;
  }

  private updateScoreAfterRepayment(studentId: string, onTime: boolean) {
    const current = this.scores.get(studentId) ?? {
      studentId,
      score: defaultLoanLimits.defaultScore,
      onTimeRepayments: 0,
      lateRepayments: 0
    };
    const score = Math.max(0, Math.min(100, current.score + (onTime ? 5 : -10)));
    const next: ReliabilityScore = {
      studentId,
      score,
      onTimeRepayments: current.onTimeRepayments + (onTime ? 1 : 0),
      lateRepayments: current.lateRepayments + (onTime ? 0 : 1)
    };
    this.scores.set(studentId, next);
    this.persistScore(next);
  }

  private ensureStudent(user: User) {
    if (user.role !== "student") throw new RepositoryError(403, "Student access required.");
  }

  private ensureAdmin(user: User) {
    if (user.role !== "admin") throw new RepositoryError(403, "Admin access required.");
  }

  private log(actor: User, action: string, entityType: string, entityId: string, metadata: Record<string, unknown>) {
    const entry: AuditLog = {
      id: id(),
      actorId: actor.id,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: now()
    };
    this.auditLogs.push(entry);
    this.db
      .prepare(
        "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run(entry.id, entry.actorId, entry.action, entry.entityType, entry.entityId ?? null, JSON.stringify(entry.metadata), entry.createdAt);
  }

  // --- Persistence helpers (write-through to SQLite) ---

  private persistUser(user: User) {
    // The password hash is pulled from the in-memory map so callers that only have
    // a User (e.g. blacklist) never accidentally wipe the stored credential.
    const passwordHash = this.passwordByUser.get(user.id) ?? null;
    this.db
      .prepare(
        "INSERT OR REPLACE INTO users (id, email, full_name, role, is_blacklisted, password_hash, email_verified, subscription_tier, subscription_renews_at, free_loans_used, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT deleted_at FROM users WHERE id = ?), COALESCE((SELECT created_at FROM users WHERE id = ?), ?))"
      )
      .run(
        user.id,
        user.email,
        user.fullName,
        user.role,
        user.isBlacklisted ? 1 : 0,
        passwordHash,
        user.emailVerified ? 1 : 0,
        user.subscriptionTier,
        user.subscriptionRenewsAt ?? null,
        user.freeLoansUsed,
        user.id,
        user.id,
        now()
      );
  }

  private persistPayment(payment: Payment) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO payments (id, user_id, loan_id, kind, amount, currency, provider, provider_ref, status, created_at, settled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        payment.id,
        payment.userId,
        payment.loanId ?? null,
        payment.kind,
        payment.amount,
        payment.currency,
        payment.provider,
        payment.providerRef,
        payment.status,
        payment.createdAt,
        payment.settledAt ?? null
      );
  }

  private persistToken(tokenHash: string, userId: string, expiresAt: number) {
    this.db
      .prepare("INSERT OR REPLACE INTO auth_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
      .run(tokenHash, userId, new Date(expiresAt).toISOString(), now());
  }

  private persistInstitution(institution: Institution) {
    this.db
      .prepare("INSERT OR REPLACE INTO institutions (id, name, email_domain) VALUES (?, ?, ?)")
      .run(institution.id, institution.name, institution.emailDomain);
  }

  private persistProfile(profile: StudentProfile) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO student_profiles (user_id, full_name, student_email, institution_id, student_number, phone_number, id_status, id_document_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        profile.userId,
        profile.fullName,
        profile.studentEmail,
        profile.institutionId,
        profile.studentNumber,
        profile.phoneNumber,
        profile.idStatus,
        profile.idDocumentPath ?? null
      );
  }

  private persistApplication(application: LoanApplication) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO loan_applications (id, student_id, amount, purpose, expected_repayment_date, status, decision_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        application.id,
        application.studentId,
        application.amount,
        application.purpose,
        application.expectedRepaymentDate,
        application.status,
        application.decisionReason ?? null,
        application.createdAt
      );
  }

  private persistLoan(loan: Loan) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO loans (id, application_id, student_id, amount, fee, repayment_amount, due_date, status, plan, installment_count, disbursed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        loan.id,
        loan.applicationId,
        loan.studentId,
        loan.amount,
        loan.fee,
        loan.repaymentAmount,
        loan.dueDate,
        loan.status,
        loan.plan,
        loan.installmentCount,
        loan.disbursedAt ?? null,
        loan.createdAt
      );
  }

  private persistRepayment(repayment: Repayment) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO repayments (id, loan_id, student_id, amount, due_date, status, method, paid_at, installment_number, installments_total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM repayments WHERE id = ?), ?))"
      )
      .run(
        repayment.id,
        repayment.loanId,
        repayment.studentId,
        repayment.amount,
        repayment.dueDate,
        repayment.status,
        repayment.method ?? null,
        repayment.paidAt ?? null,
        repayment.installmentNumber ?? 1,
        repayment.installmentsTotal ?? 1,
        repayment.id,
        now()
      );
  }

  private persistScore(score: ReliabilityScore) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO reliability_scores (student_id, score, on_time_repayments, late_repayments) VALUES (?, ?, ?, ?)"
      )
      .run(score.studentId, score.score, score.onTimeRepayments, score.lateRepayments);
  }

  // --- Load existing state on boot ---

  private load() {
    for (const row of this.db.prepare("SELECT * FROM institutions").all() as any[]) {
      this.institutions.set(row.id, { id: row.id, name: row.name, emailDomain: row.email_domain });
    }
    for (const row of this.db.prepare("SELECT * FROM users").all() as any[]) {
      const user: User = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        isBlacklisted: Boolean(row.is_blacklisted),
        emailVerified: Boolean(row.email_verified),
        subscriptionTier: (row.subscription_tier as SubscriptionTier) ?? "free",
        subscriptionRenewsAt: row.subscription_renews_at ?? null,
        freeLoansUsed: row.free_loans_used ?? 0
      };
      this.users.set(user.id, user);
      this.usersByEmail.set(user.email, user.id);
      if (row.password_hash) this.passwordByUser.set(user.id, row.password_hash);
    }
    for (const row of this.db.prepare("SELECT * FROM payments").all() as any[]) {
      const payment: Payment = {
        id: row.id,
        userId: row.user_id,
        loanId: row.loan_id ?? null,
        kind: row.kind as PaymentKind,
        amount: row.amount,
        currency: row.currency,
        provider: row.provider,
        providerRef: row.provider_ref,
        status: row.status as PaymentStatus,
        createdAt: row.created_at,
        settledAt: row.settled_at ?? null
      };
      this.payments.set(payment.id, payment);
      this.paymentsByRef.set(payment.providerRef, payment.id);
    }
    for (const row of this.db.prepare("SELECT * FROM auth_tokens").all() as any[]) {
      // Skip legacy/raw tokens without an expiry, and drop any already expired —
      // only live, hash-stored sessions are honoured.
      const expiresAt = row.expires_at ? Date.parse(row.expires_at) : NaN;
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        this.tokens.set(row.token, { userId: row.user_id, expiresAt });
      }
    }
    for (const row of this.db.prepare("SELECT * FROM student_profiles").all() as any[]) {
      this.profiles.set(row.user_id, {
        userId: row.user_id,
        fullName: row.full_name,
        studentEmail: row.student_email,
        institutionId: row.institution_id,
        studentNumber: row.student_number,
        phoneNumber: row.phone_number,
        idStatus: row.id_status,
        idDocumentPath: row.id_document_path ?? undefined
      });
    }
    for (const row of this.db.prepare("SELECT * FROM loan_applications").all() as any[]) {
      this.applications.set(row.id, {
        id: row.id,
        studentId: row.student_id,
        amount: row.amount,
        purpose: row.purpose,
        expectedRepaymentDate: row.expected_repayment_date,
        status: row.status,
        decisionReason: row.decision_reason ?? undefined,
        createdAt: row.created_at
      });
    }
    for (const row of this.db.prepare("SELECT * FROM loans").all() as any[]) {
      this.loans.set(row.id, {
        id: row.id,
        applicationId: row.application_id,
        studentId: row.student_id,
        amount: row.amount,
        fee: row.fee,
        repaymentAmount: row.repayment_amount,
        dueDate: row.due_date,
        status: row.status,
        plan: (row.plan as RepaymentPlan) ?? "bullet",
        installmentCount: row.installment_count ?? 1,
        disbursedAt: row.disbursed_at ?? null,
        createdAt: row.created_at
      });
    }
    for (const row of this.db.prepare("SELECT * FROM repayments").all() as any[]) {
      this.repayments.set(row.id, {
        id: row.id,
        loanId: row.loan_id,
        studentId: row.student_id,
        amount: row.amount,
        dueDate: row.due_date,
        paidAt: row.paid_at ?? null,
        status: row.status,
        method: row.method ?? null,
        installmentNumber: row.installment_number ?? 1,
        installmentsTotal: row.installments_total ?? 1
      });
    }
    for (const row of this.db.prepare("SELECT * FROM reliability_scores").all() as any[]) {
      this.scores.set(row.student_id, {
        studentId: row.student_id,
        score: row.score,
        onTimeRepayments: row.on_time_repayments,
        lateRepayments: row.late_repayments
      });
    }
    for (const row of this.db.prepare("SELECT * FROM feedback").all() as any[]) {
      this.feedback.set(row.id, {
        id: row.id,
        userId: row.user_id,
        category: row.category as FeedbackCategory,
        message: row.message,
        createdAt: row.created_at
      });
      if (!this.feedbackVotes.has(row.id)) this.feedbackVotes.set(row.id, new Set());
    }
    for (const row of this.db.prepare("SELECT * FROM feedback_votes").all() as any[]) {
      const set = this.feedbackVotes.get(row.feedback_id) ?? new Set<string>();
      set.add(row.user_id);
      this.feedbackVotes.set(row.feedback_id, set);
    }
  }

  private async seed() {
    const institutionId = "9e3b22ba-9951-486e-a31c-e385fd43541a";
    const adminId = "685a1b45-51bb-4de0-9846-1d37a681c9e9";

    const institutionNames: Record<string, string> = {
      "ub.ac.bw": "University of Botswana",
      "buan.ac.bw": "Botswana University of Agriculture and Natural Resources",
      "bac.ac.bw": "Botswana Accountancy College",
      "bitri.co.bw": "Botswana Institute for Technology Research and Innovation",
      "baisago.ac.bw": "BA ISAGO University",
      "botho.ac.bw": "Botho University"
    };

    // University of Botswana keeps a fixed id so seeded data stays stable.
    this.institutions.set(institutionId, {
      id: institutionId,
      name: institutionNames["ub.ac.bw"] ?? "University of Botswana",
      emailDomain: "ub.ac.bw"
    });
    this.persistInstitution(this.institutions.get(institutionId)!);

    for (const domain of allowedInstitutionDomains) {
      if (domain === "ub.ac.bw") continue;
      const institution: Institution = {
        id: id(),
        name: institutionNames[domain] ?? domain,
        emailDomain: domain
      };
      this.institutions.set(institution.id, institution);
      this.persistInstitution(institution);
    }

    // The admin account is always seeded from environment credentials with a real
    // password hash. There are no hardcoded/backdoor tokens.
    const admin: User = {
      id: adminId,
      email: adminCredentials.email,
      fullName: adminCredentials.name,
      role: "admin",
      isBlacklisted: false,
      emailVerified: true,
      subscriptionTier: "free",
      subscriptionRenewsAt: null,
      freeLoansUsed: 0
    };
    this.users.set(admin.id, admin);
    this.usersByEmail.set(admin.email, admin.id);
    this.passwordByUser.set(admin.id, await hashPassword(adminCredentials.password));
    this.persistUser(admin);

    // Dev/test-only fixtures: a neutral demo student (no real PII) plus one pending
    // application so the admin review queue isn't empty. Never seeded in production.
    if (!isProd) {
      const studentId = "8a287637-708e-4382-b166-57f2d9b18121";
      const student: User = {
        id: studentId,
        email: "demo.student@ub.ac.bw",
        fullName: "Demo Student",
        role: "student",
        isBlacklisted: false,
        emailVerified: true,
        // On PulaCash+ so the dev fixture can exercise the full P2,000 limit + plans.
        subscriptionTier: "plus",
        subscriptionRenewsAt: new Date(Date.now() + membership.plus.periodDays * 24 * 60 * 60 * 1000).toISOString(),
        freeLoansUsed: 0
      };
      this.users.set(student.id, student);
      this.usersByEmail.set(student.email, student.id);
      this.passwordByUser.set(student.id, await hashPassword("DemoStudent!2026"));
      this.persistUser(student);

      const profile: StudentProfile = {
        userId: student.id,
        fullName: student.fullName,
        studentEmail: student.email,
        institutionId,
        studentNumber: "UB2026001",
        phoneNumber: "+267 70 000 000",
        idStatus: "verified",
        idDocumentPath: `${student.id}/student-id.png`
      };
      this.profiles.set(student.id, profile);
      this.persistProfile(profile);

      const score: ReliabilityScore = {
        studentId: student.id,
        score: defaultLoanLimits.defaultScore,
        onTimeRepayments: 2,
        lateRepayments: 0
      };
      this.scores.set(student.id, score);
      this.persistScore(score);

      const application: LoanApplication = {
        id: "e37a7d60-67f6-43cc-bdbc-3dd682674a66",
        studentId: student.id,
        amount: 600,
        purpose: "Books and supplies",
        expectedRepaymentDate: new Date(Date.now() + defaultLoanLimits.minTermDays * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        status: "pending_review",
        createdAt: now()
      };
      this.applications.set(application.id, application);
      this.persistApplication(application);
    }
  }
}

export class RepositoryError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** First name only — used for the feedback board so no full name/email is exposed. */
function firstName(name: string): string {
  return name.split(" ").filter(Boolean)[0] ?? "Student";
}

/** Remaining free-tier loans for a student (PulaCash+ borrows are unlimited). */
function freeLoansRemaining(user: User): number {
  if (user.subscriptionTier === "plus") return 0;
  return Math.max(0, defaultLoanLimits.freeLoanAllowance - user.freeLoansUsed);
}
