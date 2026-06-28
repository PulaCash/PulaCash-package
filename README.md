# PulaCash

PulaCash is an iOS-first React Native + Expo MVP for Botswana university students who need small emergency microloans before the next student allowance cycle.

The workspace contains:

- `apps/mobile`: Expo Router mobile app with student and admin flows.
- `apps/api`: Fastify API with validation, role checks, loan state handling, and Drizzle schema.
- `packages/shared`: Zod schemas, typed contracts, and product constants shared by app and API.

## Quick Start

```sh
npm install
npm run typecheck
npm run test
npm run dev:api
npm run dev:mobile
```

The mobile app is designed for Expo SDK 56 and uses Expo Router route groups for auth, student, and admin areas.

## Environment

Copy the example files before running against real services:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

The API persists to a local **SQLite** database (`apps/api/pulacash.db`, created automatically and
configurable via `SQLITE_PATH`), so accounts, loans, and repayments survive restarts. Tests run
against an isolated in-memory database. Supabase, Upstash, and Resend environment variables remain
wired for future production adapters.

## MVP Loop

1. Student **registers** with an approved institutional email and a password (hashed with scrypt).
2. Student **verifies their email** (6-digit CSPRNG code) and completes their profile.
3. Student **uploads a student ID**; an **admin verifies it** (the KYC step). Email + ID together
   form a two-step identity gate that must be cleared before any money can move.
4. Dashboard shows the borrowing summary, active loan, and reliability score for the real user.
5. Student requests a loan (e.g. **P500**). A **flat 3% service fee** is added (P500 → repay P515) over a
   **≥62-day term**, and the **APR (~18%, capped at 36%) is disclosed** before acceptance.
   - The loan is **disbursed through the payment rails**; free accounts borrow up to **P500**, PulaCash+
     up to **P2,000**.
6. Student repays the loan. The amount owed is **computed and collected server-side** (never set on the
   device); the reliability score updates based on on-time payment.

The UI uses a minimalist white / light-blue design with soft rounded glass cards.

## Monetization & APR compliance

PulaCash is **Apple App Review-compliant** (Guideline 3.2.2): the loan's all-in **APR never exceeds 36%**
and the **term is always ≥ 62 days** (full repayment is never required in 60 days or less). The business
stays profitable via an optional **PulaCash+ membership (P49/month)** — a financial-service subscription
billed through the payment rails (**not** Apple IAP), which unlocks instant disbursement and the higher
P2,000 limit. Subscription revenue is near-pure margin, so blended with the 3% loan fee on a low-default,
verified-student book the model targets a **>70% margin** while keeping the loan itself low-cost to the
student.

## Payments

Disbursement and collection run through a `PaymentProvider` abstraction (`apps/api/src/services/payments.ts`):
- **`simulated`** (default, dev/test) settles synchronously so the full loop works without a gateway.
- **`http`** posts to a configured provider (Orange Money / MyZaka / DPO / Flutterwave, etc.) and settles
  via a **signed webhook** (`POST /webhooks/payments`, HMAC-SHA256 over the raw body). The service-role key
  never leaves the backend. Repayments are reconciled from provider settlement, not client input.

## Authentication & Security

- **Passwords:** hashed with Node's built-in **scrypt** (memory-hard, per-password salt); never stored
  in plain text. Login is constant-time and reveals neither which field failed nor whether an email exists.
- **Sessions:** opaque 256-bit bearer tokens; only their **SHA-256 hash** is stored, with an expiry, and
  logout revokes them. No predictable or hardcoded tokens exist.
- **Two-factor identity (KYC):** lending requires a **verified student email** *and* an **admin-verified
  student ID**. Verification codes are CSPRNG, server-side only, short-lived, and attempt-limited.
- **Admin:** seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the password is **required in production** — the
  server refuses to boot without it). Admin routes are role-gated on both client and server.
- **Password reset:** request a CSPRNG code by email, set a new password, and **all existing sessions are
  revoked** on reset. The request endpoint never reveals whether an email exists.
- **Account deletion:** in-app (`POST /account/delete`) with password re-authentication — erases/anonymises
  PII, revokes sessions, and frees the email (financial records retained, anonymised, for audit).
- **API guardrails:** every route validates input with Zod; auth/role guards on every protected route;
  malformed JSON returns 400 (not 500); the client only ever talks to our backend via the central
  `endpoints` map (no raw URLs).
- **Abuse / DoS protection:** per-IP rate limiting (in-memory baseline + optional Upstash sliding window),
  stricter limits on auth routes, request body cap (256 KB), and request/connection timeouts. `trustProxy`
  is off unless explicitly enabled behind a trusted proxy. CORS is pinned to an allow-list in production.

## Legal

Privacy Policy, Terms of Use, and a Loan Agreement are published in-app (Settings → Legal, and on the
apply screen) and as hostable Markdown at the repo root: [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md),
[`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md), [`LOAN_AGREEMENT.md`](./LOAN_AGREEMENT.md). PulaCash
operates under the laws of the **Republic of Botswana** (NBFIRA microlending regime; Data Protection Act
2018). NBFIRA microlending licensing is in progress; connect a live payment provider via `PAYMENT_PROVIDER=http`
before production launch.
