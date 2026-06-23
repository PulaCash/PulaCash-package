import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

// Postgres (Supabase) schema — the source of truth managed by drizzle-kit for
// the hosted database. Local dev uses the SQLite schema in ./schema.ts; this file
// activates for production when DATABASE_URL points at Supabase Postgres.
// Generate/apply with: npm run db:pg:generate && npm run db:pg:migrate

export const userRoleEnum = pgEnum("user_role", ["student", "admin"]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "email_pending",
  "email_verified",
  "id_pending",
  "verified",
  "rejected"
]);
export const loanApplicationStatusEnum = pgEnum("loan_application_status", ["pending_review", "approved", "rejected"]);
export const loanStatusEnum = pgEnum("loan_status", [
  "pending_review",
  "approved",
  "disbursed",
  "repayment_due",
  "repaid",
  "rejected"
]);
export const repaymentStatusEnum = pgEnum("repayment_status", ["scheduled", "due", "paid", "overdue"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 180 }).notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    supabaseUserId: uuid("supabase_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({ emailUnique: uniqueIndex("users_email_unique").on(table.email) })
);

export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    emailDomain: varchar("email_domain", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true)
  },
  (table) => ({ domainUnique: uniqueIndex("institutions_email_domain_unique").on(table.emailDomain) })
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: uuid("user_id").primaryKey(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    studentEmail: varchar("student_email", { length: 180 }).notNull(),
    institutionId: uuid("institution_id").notNull().references(() => institutions.id),
    studentNumber: varchar("student_number", { length: 32 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 24 }).notNull(),
    idStatus: verificationStatusEnum("id_status").notNull().default("email_pending"),
    idDocumentPath: text("id_document_path")
  },
  (table) => ({
    studentEmailUnique: uniqueIndex("student_profiles_email_unique").on(table.studentEmail),
    studentNumberUnique: uniqueIndex("student_profiles_student_number_unique").on(table.studentNumber)
  })
);

export const loanApplications = pgTable(
  "loan_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id").notNull().references(() => users.id),
    amount: integer("amount").notNull(),
    purpose: varchar("purpose", { length: 80 }).notNull(),
    expectedRepaymentDate: date("expected_repayment_date").notNull(),
    status: loanApplicationStatusEnum("status").notNull().default("pending_review"),
    decisionReason: text("decision_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({ studentStatusIdx: index("loan_applications_student_status_idx").on(table.studentId, table.status) })
);

export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").notNull().references(() => loanApplications.id),
  studentId: uuid("student_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull(),
  repaymentAmount: integer("repayment_amount").notNull(),
  dueDate: date("due_date").notNull(),
  status: loanStatusEnum("status").notNull().default("approved"),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const repayments = pgTable("repayments", {
  id: uuid("id").defaultRandom().primaryKey(),
  loanId: uuid("loan_id").notNull().references(() => loans.id),
  studentId: uuid("student_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(),
  dueDate: date("due_date").notNull(),
  status: repaymentStatusEnum("status").notNull().default("scheduled"),
  method: varchar("method", { length: 80 }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const reliabilityScores = pgTable("reliability_scores", {
  studentId: uuid("student_id").primaryKey(),
  score: integer("score").notNull().default(72),
  onTimeRepayments: integer("on_time_repayments").notNull().default(0),
  lateRepayments: integer("late_repayments").notNull().default(0)
});

export const authTokens = pgTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id)
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
