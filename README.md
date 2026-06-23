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

1. Student registers with an approved institutional email (real token stored on device).
2. Student completes profile (student number + phone) and a simulated student ID upload.
3. Dashboard shows the borrowing summary, active loan, and reliability score for the real user.
4. Student requests a loan (e.g. **P600**). A **25% service fee** is added (P600 → repay P750).
   - Loans up to a hidden **P2,000** threshold are auto-approved and disbursed instantly ("sent").
   - Larger amounts route to the admin review queue (approve/reject/blacklist).
5. Student repays the loan; the reliability score updates based on on-time payment.

The UI uses a minimalist white / light-blue design with soft rounded glass cards.

Production lending compliance, formal KYC policy, payment provider approval, and legal review are intentionally outside this code MVP.
