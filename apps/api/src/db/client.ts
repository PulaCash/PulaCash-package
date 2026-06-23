import Database from "better-sqlite3";
import { env } from "../env.js";

export type SqliteDb = Database.Database;

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  is_blacklisted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_domain TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_email TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  student_number TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  id_status TEXT NOT NULL DEFAULT 'email_pending',
  id_document_path TEXT
);

CREATE TABLE IF NOT EXISTS loan_applications (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  expected_repayment_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  decision_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  repayment_amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  disbursed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repayments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  method TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reliability_scores (
  student_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 72,
  on_time_repayments INTEGER NOT NULL DEFAULT 0,
  late_repayments INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
`;

/**
 * Resolve the SQLite file path. Tests run against an isolated in-memory database
 * so they never touch (or persist to) the local dev file.
 */
export function resolveDbPath(): string {
  if (env.NODE_ENV === "test") return ":memory:";
  return env.SQLITE_PATH;
}

export function createDb(path = resolveDbPath()): SqliteDb {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(DDL);
  return db;
}
