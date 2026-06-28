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
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_renews_at TEXT,
  free_loans_used INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
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
  plan TEXT NOT NULL DEFAULT 'bullet',
  installment_count INTEGER NOT NULL DEFAULT 1,
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
  installment_number INTEGER NOT NULL DEFAULT 1,
  installments_total INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reliability_scores (
  student_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 72,
  on_time_repayments INTEGER NOT NULL DEFAULT 0,
  late_repayments INTEGER NOT NULL DEFAULT 0
);

-- The token column stores the SHA-256 hash of the bearer token, never the raw
-- value, so a DB leak cannot be replayed. Tokens expire and can be revoked.
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  loan_id TEXT,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BWP',
  provider TEXT NOT NULL,
  provider_ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  feedback_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (feedback_id, user_id)
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
  migrate(db);
  return db;
}

/**
 * Idempotent, additive migrations for databases created before a column existed.
 * `CREATE TABLE IF NOT EXISTS` never alters an existing table, so we add any
 * missing columns here. Safe to run on every boot.
 */
function migrate(db: SqliteDb): void {
  const columns = (table: string) =>
    new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name));

  const userColumns = columns("users");
  if (!userColumns.has("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");
  if (!userColumns.has("email_verified")) db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  if (!userColumns.has("subscription_tier")) db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'");
  if (!userColumns.has("subscription_renews_at")) db.exec("ALTER TABLE users ADD COLUMN subscription_renews_at TEXT");
  if (!userColumns.has("free_loans_used")) db.exec("ALTER TABLE users ADD COLUMN free_loans_used INTEGER NOT NULL DEFAULT 0");
  if (!userColumns.has("deleted_at")) db.exec("ALTER TABLE users ADD COLUMN deleted_at TEXT");

  const loanColumns = columns("loans");
  if (!loanColumns.has("plan")) db.exec("ALTER TABLE loans ADD COLUMN plan TEXT NOT NULL DEFAULT 'bullet'");
  if (!loanColumns.has("installment_count")) db.exec("ALTER TABLE loans ADD COLUMN installment_count INTEGER NOT NULL DEFAULT 1");

  const repaymentColumns = columns("repayments");
  if (!repaymentColumns.has("installment_number")) db.exec("ALTER TABLE repayments ADD COLUMN installment_number INTEGER NOT NULL DEFAULT 1");
  if (!repaymentColumns.has("installments_total")) db.exec("ALTER TABLE repayments ADD COLUMN installments_total INTEGER NOT NULL DEFAULT 1");

  const tokenColumns = columns("auth_tokens");
  if (!tokenColumns.has("expires_at")) db.exec("ALTER TABLE auth_tokens ADD COLUMN expires_at TEXT");
  if (!tokenColumns.has("created_at")) db.exec("ALTER TABLE auth_tokens ADD COLUMN created_at TEXT");
}
