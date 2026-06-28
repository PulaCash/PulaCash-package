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
5. Student requests a loan (e.g. **P600**). A **25% service fee** is added (P600 → repay P750).
   - Loans up to a hidden **P2,000** threshold are auto-approved and disbursed instantly ("sent").
   - Larger amounts route to the admin review queue (approve/reject/blacklist).
6. Student repays the loan; the reliability score updates based on on-time payment.

The UI uses a minimalist white / light-blue design with soft rounded glass cards.

## Authentication & Security

- **Passwords:** hashed with Node's built-in **scrypt** (memory-hard, per-password salt); never stored
  in plain text. Login is constant-time and reveals neither which field failed nor whether an email exists.
- **Sessions:** opaque 256-bit bearer tokens; only their **SHA-256 hash** is stored, with an expiry, and
  logout revokes them. No predictable or hardcoded tokens exist.
- **Two-factor identity (KYC):** lending requires a **verified student email** *and* an **admin-verified
  student ID**. Verification codes are CSPRNG, server-side only, short-lived, and attempt-limited.
- **Admin:** seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the password is **required in production** — the
  server refuses to boot without it). Admin routes are role-gated on both client and server.
- **API guardrails:** every route validates input with Zod; auth/role guards on every protected route.
- **Abuse / DoS protection:** per-IP rate limiting (in-memory baseline + optional Upstash sliding window),
  stricter limits on auth routes, request body cap (256 KB), and request/connection timeouts. `trustProxy`
  is off unless explicitly enabled behind a trusted proxy. CORS is pinned to an allow-list in production.

## Legal

Privacy Policy, Terms of Use, and a Loan Agreement are published in-app (Settings → Legal, and on the
apply screen) and as hostable Markdown at the repo root: [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md),
[`TERMS_OF_SERVICE.md`](./TERMS_OF_SERVICE.md), [`LOAN_AGREEMENT.md`](./LOAN_AGREEMENT.md). PulaCash
operates under the laws of the **Republic of Botswana** (NBFIRA microlending regime; Data Protection Act
2018). Formal lending licensing and an approved payment/disbursement provider remain outside this code MVP.
