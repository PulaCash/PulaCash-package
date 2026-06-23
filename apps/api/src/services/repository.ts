import {
  AdminDashboard,
  allowedInstitutionDomains,
  BlacklistStudentInput,
  Dashboard,
  defaultLoanLimits,
  Loan,
  LoanApplication,
  LoanApplyInput,
  LoanApplyResult,
  Repayment,
  scoreBandFor,
  StudentProfileInput,
  User,
  VerificationStatus
} from "@pulacash/shared";
import { createDb, type SqliteDb } from "../db/client.js";

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

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const id = () => crypto.randomUUID();

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
  private tokens = new Map<string, string>();
  private institutions = new Map<string, Institution>();
  private profiles = new Map<string, StudentProfile>();
  private applications = new Map<string, LoanApplication>();
  private loans = new Map<string, Loan>();
  private repayments = new Map<string, Repayment>();
  private scores = new Map<string, ReliabilityScore>();
  private auditLogs: AuditLog[] = [];
  // Ephemeral email-verification codes (userId -> code). Short-lived by nature,
  // so they are intentionally not persisted across restarts.
  private verificationCodes = new Map<string, string>();

  constructor(db: SqliteDb = createDb()) {
    this.db = db;
    this.load();
    if (this.users.size === 0) {
      this.seed();
    }
  }

  get demoStudentToken() {
    return "demo-student-token";
  }

  get demoAdminToken() {
    return "demo-admin-token";
  }

  listInstitutions() {
    return [...this.institutions.values()];
  }

  getUserByToken(token: string | undefined) {
    if (!token) return null;
    const userId = this.tokens.get(token);
    return userId ? this.users.get(userId) ?? null : null;
  }

  register(input: { email: string; fullName: string }) {
    const email = input.email.toLowerCase();
    if (this.usersByEmail.has(email)) {
      throw new RepositoryError(409, "A PulaCash account already exists for this student email.");
    }

    const user: User = {
      id: id(),
      email,
      fullName: input.fullName,
      role: "student",
      isBlacklisted: false
    };
    const token = `student-${user.id}`;
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    this.tokens.set(token, user.id);
    const score: ReliabilityScore = {
      studentId: user.id,
      score: defaultLoanLimits.defaultScore,
      onTimeRepayments: 0,
      lateRepayments: 0
    };
    this.scores.set(user.id, score);

    this.persistUser(user);
    this.persistToken(token, user.id);
    this.persistScore(score);

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    this.verificationCodes.set(user.id, verificationCode);

    return {
      token,
      user,
      verificationCode
    };
  }

  login(email: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) throw new RepositoryError(401, "Invalid login details.");
    const user = this.users.get(userId);
    if (!user) throw new RepositoryError(401, "Invalid login details.");
    const token = user.role === "admin" ? this.demoAdminToken : `student-${user.id}`;
    this.tokens.set(token, user.id);
    this.persistToken(token, user.id);
    return { token, user };
  }

  verifyEmail(email: string, code: string) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) throw new RepositoryError(404, "No account found for this email.");
    const expected = this.verificationCodes.get(userId);
    if (!expected || expected !== code) {
      throw new RepositoryError(400, "That verification code is invalid or has expired.");
    }
    this.verificationCodes.delete(userId);
    const profile = this.profiles.get(userId);
    if (profile && profile.idStatus === "email_pending") {
      const next = { ...profile, idStatus: "email_verified" as VerificationStatus };
      this.profiles.set(userId, next);
      this.persistProfile(next);
    }
    return { verified: true };
  }

  upsertProfile(user: User, input: StudentProfileInput) {
    this.ensureStudent(user);
    const duplicate = [...this.profiles.values()].find(
      (profile) => profile.studentNumber === input.studentNumber && profile.userId !== user.id
    );
    if (duplicate) throw new RepositoryError(409, "This student ID number is already linked to another account.");

    // New accounts are treated as id_pending so a freshly registered student can
    // borrow straight away (the loan gate accepts id_pending/verified).
    const profile: StudentProfile = {
      ...input,
      userId: user.id,
      idStatus: "id_pending"
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

    return {
      student: {
        name: user.fullName,
        initials: initials(user.fullName),
        institution: institution?.name ?? "Student institution",
        verificationStatus: profile.idStatus
      },
      borrowing: {
        available: activeLoan ? 0 : defaultLoanLimits.availableToBorrow,
        limit: defaultLoanLimits.startingLimit,
        activeLoanAmount: activeLoan?.repaymentAmount ?? null,
        lastDisbursedAmount: activeLoan?.disbursedAt ? activeLoan.amount : null,
        nextDueDate: activeLoan?.dueDate ?? null
      },
      reliability: {
        score,
        label: scoreBand.label
      },
      nudges: ["Repay on time to unlock higher limits.", "Keep your student profile verified."]
    };
  }

  applyForLoan(user: User, input: LoanApplyInput): LoanApplyResult {
    this.ensureStudent(user);
    if (user.isBlacklisted) throw new RepositoryError(403, "This account is not eligible for new loans.");
    const profile = this.requireProfile(user.id);
    if (!["id_pending", "verified"].includes(profile.idStatus)) {
      throw new RepositoryError(403, "Complete student verification before applying.");
    }
    const activeLoan = [...this.loans.values()].some(
      (loan) => loan.studentId === user.id && !["repaid", "rejected"].includes(loan.status)
    );
    if (activeLoan) throw new RepositoryError(409, "Repay your active loan before applying again.");

    const instant = input.amount <= defaultLoanLimits.autoApproveThreshold;
    const application: LoanApplication = {
      id: id(),
      studentId: user.id,
      amount: input.amount,
      purpose: input.purpose,
      expectedRepaymentDate: input.expectedRepaymentDate,
      status: instant ? "approved" : "pending_review",
      createdAt: now()
    };
    this.applications.set(application.id, application);
    this.persistApplication(application);

    if (instant) {
      const { loan, repayment } = this.createLoanFromApplication(application);
      this.log(user, "loan.auto_disburse", "loan", loan.id, { amount: loan.amount });
      return { status: "disbursed", loan, repayment };
    }

    return { status: "pending_review", application };
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

  initiateRepayment(user: User, loanId: string, amount: number, method: string) {
    this.ensureStudent(user);
    const loan = this.getLoanForUser(user, loanId);
    if (loan.status === "repaid") throw new RepositoryError(409, "This loan is already repaid.");

    const onTime = today() <= loan.dueDate;
    const repayment: Repayment = {
      id: id(),
      loanId: loan.id,
      studentId: user.id,
      amount,
      dueDate: loan.dueDate,
      paidAt: now(),
      status: "paid",
      method
    };
    this.repayments.set(repayment.id, repayment);
    this.persistRepayment(repayment);

    const repaidLoan: Loan = { ...loan, status: "repaid" };
    this.loans.set(loan.id, repaidLoan);
    this.persistLoan(repaidLoan);

    this.updateScoreAfterRepayment(user.id, onTime);

    return repayment;
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

  approveLoan(user: User, applicationId: string) {
    this.ensureAdmin(user);
    const application = this.requireApplication(applicationId);
    if (application.status !== "pending_review") throw new RepositoryError(409, "Application was already reviewed.");

    const approved = { ...application, status: "approved" as const };
    this.applications.set(application.id, approved);
    this.persistApplication(approved);

    const { loan, repayment } = this.createLoanFromApplication(approved);
    this.log(user, "loan.approve", "loan_application", application.id, { loanId: loan.id });
    return { application: approved, loan, repayment };
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

  /** Create the disbursed loan + scheduled repayment for an approved application. */
  private createLoanFromApplication(application: LoanApplication): { loan: Loan; repayment: Repayment } {
    const fee = Math.round(application.amount * defaultLoanLimits.feeRate);
    const loan: Loan = {
      id: id(),
      applicationId: application.id,
      studentId: application.studentId,
      amount: application.amount,
      fee,
      repaymentAmount: application.amount + fee,
      dueDate: application.expectedRepaymentDate,
      status: "disbursed",
      disbursedAt: now(),
      createdAt: now()
    };
    const repayment: Repayment = {
      id: id(),
      loanId: loan.id,
      studentId: loan.studentId,
      amount: loan.repaymentAmount,
      dueDate: loan.dueDate,
      paidAt: null,
      status: loan.dueDate <= today() ? "due" : "scheduled",
      method: null
    };
    this.loans.set(loan.id, loan);
    this.persistLoan(loan);
    this.repayments.set(repayment.id, repayment);
    this.persistRepayment(repayment);
    return { loan, repayment };
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
    this.db
      .prepare(
        "INSERT OR REPLACE INTO users (id, email, full_name, role, is_blacklisted, created_at) VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM users WHERE id = ?), ?))"
      )
      .run(user.id, user.email, user.fullName, user.role, user.isBlacklisted ? 1 : 0, user.id, now());
  }

  private persistToken(token: string, userId: string) {
    this.db.prepare("INSERT OR REPLACE INTO auth_tokens (token, user_id) VALUES (?, ?)").run(token, userId);
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
        "INSERT OR REPLACE INTO loans (id, application_id, student_id, amount, fee, repayment_amount, due_date, status, disbursed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        loan.disbursedAt ?? null,
        loan.createdAt
      );
  }

  private persistRepayment(repayment: Repayment) {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO repayments (id, loan_id, student_id, amount, due_date, status, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM repayments WHERE id = ?), ?))"
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
        isBlacklisted: Boolean(row.is_blacklisted)
      };
      this.users.set(user.id, user);
      this.usersByEmail.set(user.email, user.id);
    }
    for (const row of this.db.prepare("SELECT * FROM auth_tokens").all() as any[]) {
      this.tokens.set(row.token, row.user_id);
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
        method: row.method ?? null
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
  }

  private seed() {
    const institutionId = "9e3b22ba-9951-486e-a31c-e385fd43541a";
    const studentId = "8a287637-708e-4382-b166-57f2d9b18121";
    const adminId = "685a1b45-51bb-4de0-9846-1d37a681c9e9";

    const institutionNames: Record<string, string> = {
      "ub.ac.bw": "University of Botswana",
      "buan.ac.bw": "Botswana University of Agriculture and Natural Resources",
      "bac.ac.bw": "Botswana Accountancy College",
      "bitri.co.bw": "Botswana Institute for Technology Research and Innovation",
      "baisago.ac.bw": "BA ISAGO University",
      "botho.ac.bw": "Botho University"
    };

    // University of Botswana keeps a fixed id so seeded demo data stays stable.
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

    const student: User = {
      id: studentId,
      email: "thatayotlhe.tsenang@ub.ac.bw",
      fullName: "Thatayotlhe Tsenang",
      role: "student",
      isBlacklisted: false
    };
    const admin: User = {
      id: adminId,
      email: "admin@ub.ac.bw",
      fullName: "PulaCash Admin",
      role: "admin",
      isBlacklisted: false
    };

    this.users.set(student.id, student);
    this.users.set(admin.id, admin);
    this.usersByEmail.set(student.email, student.id);
    this.usersByEmail.set(admin.email, admin.id);
    this.persistUser(student);
    this.persistUser(admin);

    this.tokens.set(this.demoStudentToken, student.id);
    this.tokens.set(this.demoAdminToken, admin.id);
    this.persistToken(this.demoStudentToken, student.id);
    this.persistToken(this.demoAdminToken, admin.id);

    const profile: StudentProfile = {
      userId: student.id,
      fullName: student.fullName,
      studentEmail: student.email,
      institutionId,
      studentNumber: "UB2026001",
      phoneNumber: "+267 71 234 567",
      idStatus: "verified",
      idDocumentPath: `student-ids/${student.id}/student-id.png`
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
      expectedRepaymentDate: "2026-07-15",
      status: "pending_review",
      createdAt: now()
    };
    this.applications.set(application.id, application);
    this.persistApplication(application);
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
