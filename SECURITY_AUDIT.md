# PulaCash — Security Audit & App Store Compliance Plan

_Audit date: 2026-06-25 · Scope: `apps/api`, `apps/mobile`, `packages/shared`, build/config_

> **Bottom line:** As written, the app **cannot be submitted to the App Store** (the
> lending model breaks Apple's loan-APR rule) and **must not be shipped** to real users
> (authentication is effectively absent and every account — including admin — can be
> taken over). Both the product/legal model and the auth layer need rework before any
> public build. Details, severities, and a phased plan below.

Legend — severity: **🔴 Critical** (do-not-ship), **🟠 High**, **🟡 Medium**, **⚪ Low/Hardening**.
Each item cites `file:line` so it can be fixed and re-verified.

---

## Remediation status — `v0.2.0` (2026-06-28)

The authentication/authorization rework and compliance/legal scaffolding in this release
resolve the Phase-0 security gates and most of the hardening items:

- **Fixed:** SEC-C1 (scrypt password hashing + real login), SEC-C2 (opaque 256-bit tokens,
  hash-at-rest), SEC-C3 (no seeded/hardcoded tokens; demo tokens removed from server **and**
  bundle), SEC-C4 (client bypass off by default + dev-only, admin routes role-gated on client
  & server), SEC-C5 (CSPRNG codes, server-only, TTL + attempt limits, **enforced** before
  lending), SEC-H3 (email **and** admin-verified ID required before any loan — the "2FA" gate),
  SEC-H5 (token hashing; passwords hashed), SEC-M1 (codes never logged in prod), SEC-M2 (token
  expiry + logout revocation), SEC-M3 (test suite rewritten green), SEC-M4 (real PII removed from
  seeds/bundle), SEC-M5 (`trustProxy` now env-gated, off by default), SEC-H2 (credentialed CORS
  dropped; prod origin allow-list enforced at boot).
- **Compliance:** APP-3 (Privacy Policy, Terms, Loan Agreement — in-app + repo-root Markdown,
  Botswana jurisdiction; explicit opt-in consent replaces the pre-checked box), partial APP-5
  (demo bypass/admin link removed or gated; misleading settings rows removed).
- **Deferred to v0.3.0 (see below):** APP-1, APP-2, APP-4, SEC-H1.

## Remediation status — `v0.3.0` (2026-06-28)

The monetization/compliance and payments rework in this release resolves the remaining
do-not-ship / can't-submit blockers from Phase 1:

- **APP-1 (loan APR/term) — fixed.** Flat **3% fee** + **≥62-day minimum term** ⇒ all-in **APR ~18%,
  hard-capped under 36%**, and full repayment is never required in ≤60 days. The APR + term are disclosed
  on the apply screen and in the loan agreement. Profitability is preserved via an optional **PulaCash+
  membership (P49/mo)** billed off-IAP through the payment rails.
- **APP-2 (account deletion) — fixed.** In-app `POST /account/delete` with password re-auth: erases/anonymises
  PII, revokes sessions, frees the email; retained financial records are anonymised.
- **APP-4 / SEC-H1 (payments + settlement) — fixed.** Real `PaymentProvider` abstraction (simulated default,
  `http` provider scaffold) with signed settlement webhook. **Repayment is computed server-side and reconciled
  from settlement — the client can no longer under-pay to clear a loan** (verified by test + live check).
- **Also added:** password reset (with session revocation), standalone email-confirmation screen, and the
  client routes all calls through a central `endpoints` map (no raw URLs).
- **Still open (external/process):** APP-6 (NBFIRA licensing — in progress) and SEC-H4 (the loan auto-approve
  threshold still equals the cap, so the loan-review queue stays inert by design; the admin's real control is
  ID verification). Connect a live `PAYMENT_PROVIDER=http` before production launch.

---

## Part A — Internal security issues

### 🔴 Critical

**SEC-C1 — No password check; login by email alone (full authentication bypass).**
`repository.login(email)` looks a user up by email and returns a token with **no
credential check** (`apps/api/src/services/repository.ts:139`). `authLoginSchema`
*requires* a password (`packages/shared/src/schemas.ts:37`) but it is never read,
never hashed, never stored — there is no password column (`apps/api/src/db/client.ts:7`)
and no hashing library anywhere in `apps/api/src`.
**Impact:** anyone who knows or guesses an email signs in as that user. The admin email
`admin@ub.ac.bw` is seeded and guessable; student emails follow `first.last@ub.ac.bw`.
**Fix:** store an Argon2id/bcrypt hash at registration; verify it in `login`; reject the
existing passwordless path.

**SEC-C2 — Predictable bearer tokens → account takeover.**
The token is literally `` `student-${user.id}` `` (`repository.ts:113`, `:144`). User IDs
are returned all over the API (`/me`, dashboards, admin student lists, and every loan/
repayment object carries `studentId`). Knowing any user's ID yields their token.
**Impact:** chained with SEC-C3, an attacker lists every student ID via the admin API and
derives every student's token — total compromise of all accounts.
**Fix:** issue opaque random tokens (`crypto.randomBytes(32)`) unrelated to the user ID,
or signed short-lived JWTs; store only a hash of the token.

**SEC-C3 — Hardcoded, permanent admin/student tokens (server backdoor, also shipped in the client).**
`demo-student-token` and `demo-admin-token` are seeded into `auth_tokens`
(`repository.ts:724`) and grant student/admin access **forever**. They are also baked into
the mobile bundle (`apps/mobile/src/lib/demo-data.ts:13`).
**Impact:** `Authorization: Bearer demo-admin-token` against the live API = full admin
(list/search all students + PII, approve/reject loans, blacklist anyone).
**Fix:** never seed real tokens; gate any demo seeding behind `NODE_ENV !== 'production'`
and a separate flag; rotate/remove before any deploy.

**SEC-C4 — Client auth bypass is ON by default; admin reachable by any user.**
`demoAuthBypassEnabled = process.env.EXPO_PUBLIC_DEMO_AUTH_BYPASS !== "false"`
(`apps/mobile/src/lib/api.ts:6`) defaults to **true**, and `EXPO_PUBLIC_*` values are
compiled into the shipped JS. The production EAS profile sets no env
(`apps/mobile/eas.json:14`), so a release build ships in bypass mode using the demo
tokens. `getAuthToken("admin")` returns the admin token (`api.ts:26`), the student
**"Admin dashboard"** link is shown to everyone (`apps/mobile/app/(student)/more.tsx:64`),
and there is no client-side role gate (`apps/mobile/app/(admin)/_layout.tsx`).
**Fix:** default the flag to `false`; strip the bypass and demo tokens from production
builds entirely; gate `(admin)` routes on a verified admin session.

**SEC-C5 — Email verification is non-secret and non-enforced.**
The 6-digit code is generated with `Math.random()` (not a CSPRNG) and **returned in the
register response** (`repository.ts:129` → `apps/api/src/routes/auth.ts:24`). It never
expires (no TTL; the email claims "15 minutes" — `apps/api/src/services/email.ts:34`).
Verification is not a borrowing gate: registration issues a token immediately, profile
creation sets `id_pending` directly, and `applyForLoan` accepts `id_pending`
(`repository.ts:236`). So **register → profile → instant loan** with no verified identity.
**Fix:** CSPRNG codes, server-side only, with expiry + attempt limits; require verified
state before profile/loan actions.

### 🟠 High

**SEC-H1 — Repayment integrity: client supplies the amount, any amount marks the loan fully repaid.**
`initiateRepayment` marks the loan `repaid` and increases the reliability score
**regardless of `amount`** (`repository.ts:278`). The schema's `amount` has no relation to
what's owed (`schemas.ts:65`). Paying **P0.01 clears a P750 loan and adds +5 to the score.**
There is also no payment processor — disbursement/repayment are bookkeeping only
(`method` is a free enum), so the app depicts money movement that never happens.
**Fix:** compute settlement server-side from the loan; integrate a real payment provider;
reconcile against provider webhooks, not client input.

**SEC-H2 — CORS reflects any origin with credentials.**
`APP_ORIGIN` defaults to `*` (`apps/api/src/env.ts:7`, `.env.example:5`) →
`origin: true` + `credentials: true` (`apps/api/src/app.ts:28`). Reflecting arbitrary
origins with credentials is unsafe the moment any cookie/credentialed auth is added.
**Fix:** require an explicit origin allow-list in production; never combine `*` with
`credentials: true`.

**SEC-H3 — No KYC / identity verification behind unsecured instant lending.**
"Upload ID" only records a storage path (`repository.ts:187`); nothing checks the
document, name match, or enrollment. Loans auto-disburse up to P2,000 with `id_pending`
and no affordability/eligibility logic.
**Fix:** real document/identity verification + eligibility checks before disbursement
(also a legal/regulatory requirement — see APP-7).

**SEC-H4 — The admin review path is effectively dead; everything auto-approves.**
`autoApproveThreshold (2000) === maxAmount (2000)` (`packages/shared/src/constants.ts:53`)
and the schema caps `amount` at 2000 (`schemas.ts:59`), so **no valid application can
exceed the auto-approve threshold** — all loans disburse instantly and the admin
approve/reject queue is unreachable except for seeded data. The only human control in the
system is inert.
**Fix:** decide the real policy; set the auto-approve threshold below the max, or remove
the illusion of review.

**SEC-H5 — PII and tokens stored in plaintext at rest.**
SQLite holds names, student emails, student numbers, phone numbers, ID document paths, and
bearer tokens with no encryption or token hashing (`apps/api/src/db/client.ts`,
`repository.ts` `persist*`).
**Fix:** hash tokens; encrypt sensitive columns or rely on managed at-rest encryption +
strict access control; minimize what's stored.

### 🟡 Medium

- **SEC-M1 — Verification code + recipient email logged in plaintext** on the dev path
  (`email.ts:25`); logger redaction covers `req.body.code` but not service-emitted logs
  (`apps/api/src/lib/logger.ts:16`).
- **SEC-M2 — No token revocation/expiry/rotation.** Logout only clears client storage
  (`more.tsx:29`); the server token lives forever.
- **SEC-M3 — Tests are stale/red and there is no CI.** `api.test.ts:64` asserts the old
  15% economics (`repaymentAmount: 690`) and `:90` expects a 5000 amount to route to
  review — both contradict current constants/schema, so the suite fails, and there is no
  `.github` workflow to catch it. The quality gate is effectively off.
- **SEC-M4 — Real-looking personal data shipped as seed/demo data** (name, institutional
  email, Botswana phone number) in `repository.ts:702` and `demo-data.ts:16` — embedded in
  both the repo and the app bundle.
- **SEC-M5 — `trustProxy: true` unconditionally** (`app.ts:18`) lets any peer spoof
  `X-Forwarded-For`, defeating IP-keyed rate limits (`apps/api/src/lib/rate-limit.ts:33`)
  unless strictly behind a trusted proxy.

### ⚪ Low / Hardening

- **SEC-L1** — `repaymentInitiateSchema.amount` has no upper bound (`schemas.ts:67`).
- **SEC-L2** — `expectedRepaymentDate` isn't constrained to the future or a max term
  (`schemas.ts:62`).
- **SEC-L3** — Production API must be HTTPS; `API_URL` defaults to `http://localhost`
  (`api.ts:4`). No ATS override exists (good — keep it that way).
- **SEC-L4** — Confirm HSTS/security headers at the edge; CSP is intentionally off for the
  JSON API (`app.ts:26`), which is acceptable.

---

## Part B — App Store compliance (iOS-first)

> Guideline numbers below reflect Apple's App Review Guidelines; **verify against the live
> version at submission** as numbering shifts. The substance is stable.

**APP-1 — 🔴 Loan APR/term rule (the single biggest blocker; Guideline 3.2.2, personal-loans provision).**
Apple requires loan apps to disclose the **equivalent maximum APR**, forbids an **APR over
36%** (including all fees), and forbids requiring **repayment in full in 60 days or less**.
PulaCash charges **25% per loan** with full repayment in **~1 month** (example: disbursed
2026-06-13, due 2026-07-15 = 32 days). That is roughly a **~285% APR** and a sub-60-day
full-repayment term — **both prongs violated** — and the UI shows only a flat "Interest
(25%)" with no APR (`apps/mobile/app/(student)/apply.tsx:182`).
**Required:** restructure the product — APR ≤ 36% all-in **and** term ≥ 60 days (or change
the model) — and disclose the APR and due date clearly in-app.

**APP-2 — 🔴 Account deletion (Guideline 5.1.1(v)).**
Apps that support account creation must let users **initiate account deletion in-app**.
None exists (no UI, no `DELETE` endpoint).
**Required:** add in-app account deletion + a server endpoint that erases/anonymizes data.

**APP-3 — 🔴 Privacy policy, terms, and loan agreement (Guideline 5.1.1 + metadata).**
No privacy policy, terms of service, EULA, or loan agreement anywhere in the app or repo.
A financial app handling PII must publish and link a privacy policy (App Store listing +
in-app) and present enforceable loan terms.
**Required:** privacy policy URL, in-app Terms/Privacy links, and a real loan agreement
shown before acceptance. Replace the pre-checked `acceptedTerms: true` default
(`apply.tsx:30`) with explicit opt-in linking the actual terms.

**APP-4 — 🔴 Real money movement / payments (Guidelines 3.1.1 vs 3.2.1).**
Lending is a "real-world service," so it's outside IAP — but there is **no payment
integration at all**, so disbursement/repayment are simulated. That fails App Completeness
and, once real, requires approved payment rails and an eligible (registered/licensed)
submitting entity.
**Required:** integrate a licensed payment/disbursement provider; submit as the registered
financial entity.

**APP-5 — 🔴 App completeness & accurate metadata (Guidelines 2.1, 2.3.1).**
- Demo auth bypass and a "Continue with the seeded student profile" login screen
  (`apps/mobile/app/(auth)/login.tsx`) = a demo, not a finished app.
- Non-functional placeholder rows (Personal details, Security, Notifications, Help) and a
  **"Face ID / Biometric login: On"** toggle that does nothing (`more.tsx:59`) misrepresent
  features.
- A user-reachable **Admin dashboard** is an undocumented/privileged feature (2.3.1).
- "No hidden fees" (`apply.tsx:183`) alongside an intentionally hidden P2,000 cap and an
  undisclosed APR is deceptive.
**Required:** ship real auth, remove the bypass, make every surfaced control functional or
remove it, and remove user access to admin.

**APP-6 — 🟠 Regulatory/legal posture in Botswana (Guidelines 3.2.1 / 1.x + local law).**
Consumer lending implicates **NBFIRA** microlending registration, consumer-credit
disclosure, and the **Botswana Data Protection Act 2018**. The README explicitly defers
"lending compliance, formal KYC, payment provider approval, and legal review"
(`README.md:49`) — Apple commonly asks lenders for proof of licensing.
**Required:** obtain licensing/registration and legal review before submission.

**APP-7 — 🟠 App Privacy "nutrition labels" & data disclosure (Guideline 5.1.1).**
The label must accurately declare collection of email, phone, **government/student ID
image**, and financial data, with linkage/usage. Camera/Photos purpose strings exist
(`apps/mobile/app.json:18`) — keep them matched to actual use.

**APP-8 — 🟡 Age rating / 18+ gating.**
Lending is adults-only; set the age rating to 18+ and gate onboarding accordingly.

---

## Part C — Prioritized remediation plan

**Phase 0 — Do-not-ship security gates (fix before any non-local build).**
SEC-C1 (password hashing + real login), SEC-C2 (opaque tokens), SEC-C3 (remove seeded
tokens from server + bundle), SEC-C4 (default bypass off; strip from prod; gate admin
routes), SEC-C5 (CSPRNG + server-only codes + enforce verification), SEC-H1 (server-side
settlement, no client amount).

**Phase 1 — Compliance blockers (parallel; gate App Store submission).**
APP-1 (APR ≤ 36% + term ≥ 60 days + APR disclosure), APP-2 (account deletion),
APP-3 (privacy policy / terms / loan agreement + opt-in consent), APP-4 (real payment
rails), APP-6 (licensing/KYC/legal), SEC-H3 (real identity verification).

**Phase 2 — App completeness & metadata (clear the 2.1 / 2.3.1 rejections).**
APP-5 (real auth UI, remove demo bypass + admin link, finish or remove placeholder
controls), APP-7 (privacy labels), APP-8 (age gating), SEC-H4 (real review policy or
remove the illusion).

**Phase 3 — Hardening & hygiene.**
SEC-H2 (CORS allow-list), SEC-H5 (token hashing + at-rest protection), SEC-M1 (don't log
codes), SEC-M2 (token expiry/revocation), SEC-M3 (fix tests + add CI), SEC-M4 (remove real
PII from seeds), SEC-M5 (scope `trustProxy`), SEC-L1–L4.

**Suggested verification after fixes:** `npm run typecheck && npm run test` (currently red
— see SEC-M3), plus a manual check that `Bearer demo-admin-token` and a derived
`student-<id>` token are both rejected by the live API.

---

### Quick reference — issue index

| ID | Sev | One-liner |
|----|-----|-----------|
| SEC-C1 | 🔴 | Login ignores password (auth bypass) |
| SEC-C2 | 🔴 | Token = `student-<userId>` (takeover) |
| SEC-C3 | 🔴 | Hardcoded permanent admin/student tokens |
| SEC-C4 | 🔴 | Client demo-bypass on by default; admin open to all |
| SEC-C5 | 🔴 | Verification code returned/weak/unenforced |
| SEC-H1 | 🟠 | Any repayment amount clears the loan |
| SEC-H2 | 🟠 | CORS `*` + credentials |
| SEC-H3 | 🟠 | No KYC behind instant lending |
| SEC-H4 | 🟠 | Admin review unreachable; all auto-approve |
| SEC-H5 | 🟠 | PII + tokens stored plaintext |
| SEC-M1..M5 | 🟡 | Logged codes, no token expiry, red tests/no CI, real PII in seeds, spoofable proxy |
| SEC-L1..L4 | ⚪ | Repay amount cap, date bounds, HTTPS, headers |
| APP-1 | 🔴 | APR ~285% & <60-day term break the loans rule |
| APP-2 | 🔴 | No in-app account deletion |
| APP-3 | 🔴 | No privacy policy / terms / loan agreement |
| APP-4 | 🔴 | No real payment rails (incomplete) |
| APP-5 | 🔴 | Demo/incomplete app + misleading UI |
| APP-6 | 🟠 | Botswana lending licensing / data-protection law |
| APP-7 | 🟡 | Accurate App Privacy labels |
| APP-8 | 🟡 | 18+ age gating |
