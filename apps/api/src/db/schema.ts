import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// SQLite schema for PulaCash. Tables mirror the entities the repository stores so
// state survives a restart. Timestamps/dates are stored as ISO strings, booleans
// as integers (0/1), and JSON blobs as text.

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: ["student", "admin"] }).notNull().default("student"),
  isBlacklisted: integer("is_blacklisted", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`)
});

export const institutions = sqliteTable("institutions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emailDomain: text("email_domain").notNull().unique()
});

export const studentProfiles = sqliteTable("student_profiles", {
  userId: text("user_id").primaryKey(),
  fullName: text("full_name").notNull(),
  studentEmail: text("student_email").notNull(),
  institutionId: text("institution_id").notNull(),
  studentNumber: text("student_number").notNull(),
  phoneNumber: text("phone_number").notNull(),
  idStatus: text("id_status", {
    enum: ["email_pending", "email_verified", "id_pending", "verified", "rejected"]
  })
    .notNull()
    .default("email_pending"),
  idDocumentPath: text("id_document_path")
});

export const loanApplications = sqliteTable("loan_applications", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull(),
  amount: integer("amount").notNull(),
  purpose: text("purpose").notNull(),
  expectedRepaymentDate: text("expected_repayment_date").notNull(),
  status: text("status", { enum: ["pending_review", "approved", "rejected"] })
    .notNull()
    .default("pending_review"),
  decisionReason: text("decision_reason"),
  createdAt: text("created_at").notNull()
});

export const loans = sqliteTable("loans", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  studentId: text("student_id").notNull(),
  amount: integer("amount").notNull(),
  fee: integer("fee").notNull(),
  repaymentAmount: integer("repayment_amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", {
    enum: ["pending_review", "approved", "disbursed", "repayment_due", "repaid", "rejected"]
  })
    .notNull()
    .default("approved"),
  disbursedAt: text("disbursed_at"),
  createdAt: text("created_at").notNull()
});

export const repayments = sqliteTable("repayments", {
  id: text("id").primaryKey(),
  loanId: text("loan_id").notNull(),
  studentId: text("student_id").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["scheduled", "due", "paid", "overdue"] }).notNull().default("scheduled"),
  method: text("method"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").notNull()
});

export const reliabilityScores = sqliteTable("reliability_scores", {
  studentId: text("student_id").primaryKey(),
  score: integer("score").notNull().default(72),
  onTimeRepayments: integer("on_time_repayments").notNull().default(0),
  lateRepayments: integer("late_repayments").notNull().default(0)
});

export const authTokens = sqliteTable("auth_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull()
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: text("metadata", { mode: "json" }).notNull().default("{}"),
  createdAt: text("created_at").notNull()
});
