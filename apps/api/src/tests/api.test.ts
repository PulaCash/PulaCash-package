import { describe, expect, it } from "vitest";
import { computeApr, installmentSchedule, installmentTermDays, loanFee } from "@pulacash/shared";
import { createApp } from "../app.js";

const ADMIN_EMAIL = "tsenangthatayotlhe04@gmail.com";
const ADMIN_PASSWORD = "PulaCashAdmin!2026";
const DEMO_EMAIL = "demo.student@ub.ac.bw"; // seeded PulaCash+ student
const DEMO_PASSWORD = "DemoStudent!2026";

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const TERM_DATE = futureDate(65); // satisfies the >=62-day minimum bullet term

type App = Awaited<ReturnType<typeof createApp>>;

async function login(app: App, email: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  expect(res.statusCode, res.payload).toBe(200);
  return res.json().token as string;
}

async function ubInstitutionId(app: App) {
  const res = await app.inject({ method: "GET", url: "/institutions" });
  return (res.json() as Array<{ id: string; emailDomain: string }>).find((i) => i.emailDomain === "ub.ac.bw")!.id;
}

const applyLoan = (app: App, token: string, body: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/loans/apply", headers: auth(token), payload: { acceptedTerms: true, ...body } });

const repay = (app: App, token: string, loanId: string) =>
  app.inject({ method: "POST", url: "/repayments/initiate", headers: auth(token), payload: { loanId, method: "orange_money" } });

/** Register → verify email → profile → upload ID → admin verifies. Free tier by default. */
async function onboardVerifiedStudent(app: App, email: string) {
  const reg = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, fullName: "Onboarded Student", password: "password123" }
  });
  const token = reg.json().token as string;
  const code = reg.json().demoVerificationCode as string;
  await app.inject({ method: "POST", url: "/auth/verify-email", payload: { email, code } });
  const institutionId = await ubInstitutionId(app);
  await app.inject({
    method: "POST",
    url: "/student/profile",
    headers: auth(token),
    payload: {
      fullName: "Onboarded Student",
      studentEmail: email,
      institutionId,
      studentNumber: `UB${Math.floor(Math.random() * 1_000_000)}`,
      phoneNumber: "+267 71 222 333"
    }
  });
  await app.inject({
    method: "POST",
    url: "/student/upload-id",
    headers: auth(token),
    payload: { fileName: "id.png", mimeType: "image/png", sizeBytes: 5000, content: Buffer.from("fake-id-bytes").toString("base64") }
  });
  const studentId = (await app.inject({ method: "GET", url: "/me", headers: auth(token) })).json().id as string;
  const adminToken = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
  await app.inject({
    method: "POST",
    url: `/admin/students/${studentId}/verify-id`,
    headers: auth(adminToken),
    payload: { approved: true }
  });
  return { token, studentId };
}

describe("PulaCash API — authentication", () => {
  it("rejects a wrong password, accepts the right one", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: DEMO_EMAIL, password: "nope12345" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } })).statusCode).toBe(200);
  });

  it("rejects the old hardcoded/predictable bearer tokens", async () => {
    const app = await createApp();
    for (const token of ["demo-admin-token", "demo-student-token", "student-8a287637-708e-4382-b166-57f2d9b18121"]) {
      expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
    }
  });

  it("validates institutional student emails at registration", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "student@gmail.com", fullName: "Demo Student", password: "password123" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("approved student email");
  });

  it("returns 400 (not 500) for a malformed JSON body", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{ not valid json"
    });
    expect(response.statusCode).toBe(400);
  });

  it("requires authentication on protected routes", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "GET", url: "/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/student/dashboard" })).statusCode).toBe(401);
  });

  it("revokes the token on logout (empty JSON body is accepted)", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const out = await app.inject({ method: "POST", url: "/auth/logout", headers: { ...auth(token), "content-type": "application/json" }, payload: "" });
    expect(out.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
  });
});

describe("PulaCash API — password reset & account deletion", () => {
  it("resets the password with an emailed code and revokes old sessions", async () => {
    const app = await createApp();
    const oldToken = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const req = await app.inject({ method: "POST", url: "/auth/request-password-reset", payload: { email: DEMO_EMAIL } });
    const code = req.json().demoResetCode as string;
    expect(code).toMatch(/^\d{6}$/);
    expect((await app.inject({ method: "POST", url: "/auth/reset-password", payload: { email: DEMO_EMAIL, code, newPassword: "brand-new-pass-1" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: DEMO_EMAIL, password: "brand-new-pass-1" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(oldToken) })).statusCode).toBe(401);
  });

  it("deletes an account after re-authentication and frees the email", async () => {
    const app = await createApp();
    const email = "deletes.me@ub.ac.bw";
    const { token } = await onboardVerifiedStudent(app, email);
    expect((await app.inject({ method: "POST", url: "/account/delete", headers: auth(token), payload: { password: "wrongpass1", confirm: true } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/account/delete", headers: auth(token), payload: { password: "password123", confirm: true } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/register", payload: { email, fullName: "Reused", password: "password123" } })).statusCode).toBe(200);
  });
});

describe("PulaCash API — loans, APR & server-side settlement", () => {
  it("disburses at the term-scaled fee with a compliant APR (<36%)", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const res = await applyLoan(app, token, { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE });
    expect(res.statusCode, res.payload).toBe(200);
    const fee = loanFee(600, 65);
    expect(res.json()).toMatchObject({ status: "disbursed", loan: { amount: 600, fee, repaymentAmount: 600 + fee }, payment: { status: "settled" } });
    expect(computeApr(fee, 600, 65)).toBeLessThan(0.36);
  });

  it("rejects a bullet term shorter than the 62-day minimum", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    expect((await applyLoan(app, token, { amount: 300, purpose: "Transport", expectedRepaymentDate: futureDate(30) })).statusCode).toBe(400);
  });

  it("computes the repayment server-side — the client cannot under-pay to clear a loan", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const applied = await applyLoan(app, token, { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE });
    const loanId = applied.json().loan.id as string;
    const total = applied.json().loan.repaymentAmount as number;
    // Client tries to send amount: 1 — it is stripped; the server charges the full total.
    const result = await app.inject({ method: "POST", url: "/repayments/initiate", headers: auth(token), payload: { loanId, method: "orange_money", amount: 1 } });
    expect(result.statusCode, result.payload).toBe(200);
    expect(result.json()).toMatchObject({ loanStatus: "repaid", payment: { amount: total, status: "settled" } });
  });

  it("rejects loan amounts above the hard P2,000 cap", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    expect((await applyLoan(app, token, { amount: 5000, purpose: "Transport", expectedRepaymentDate: TERM_DATE })).statusCode).toBe(400);
  });
});

describe("PulaCash API — free-tier funnel & subscription", () => {
  it("gives free students one P300 loan, then requires PulaCash+", async () => {
    const app = await createApp();
    const { token } = await onboardVerifiedStudent(app, "freebie@ub.ac.bw");

    // Over the free P300 cap.
    expect((await applyLoan(app, token, { amount: 400, purpose: "Transport", expectedRepaymentDate: TERM_DATE })).statusCode).toBe(403);

    // First free loan is allowed; repay it.
    const first = await applyLoan(app, token, { amount: 300, purpose: "Transport", expectedRepaymentDate: TERM_DATE });
    expect(first.statusCode, first.payload).toBe(200);
    expect((await repay(app, token, first.json().loan.id)).statusCode).toBe(200);

    // Second free loan is blocked — the funnel forces a subscription.
    const second = await applyLoan(app, token, { amount: 300, purpose: "Transport", expectedRepaymentDate: TERM_DATE });
    expect(second.statusCode).toBe(403);
    expect(second.json().error).toContain("PulaCash+");

    // Subscribe, then borrowing is unlocked again (and above the free cap).
    const sub = await app.inject({ method: "POST", url: "/subscriptions/subscribe", headers: auth(token), payload: { tier: "plus", paymentMethod: "orange_money" } });
    expect(sub.statusCode, sub.payload).toBe(200);
    expect(sub.json().user.subscriptionTier).toBe("plus");
    expect((await applyLoan(app, token, { amount: 800, purpose: "Transport", expectedRepaymentDate: TERM_DATE })).statusCode).toBe(200);
  });
});

describe("PulaCash API — installment plans (PulaCash+)", () => {
  it("splits a large loan into monthly installments and closes it on the last one", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD); // PulaCash+
    const res = await applyLoan(app, token, {
      amount: 1500,
      purpose: "Accommodation",
      expectedRepaymentDate: TERM_DATE,
      repaymentPlan: "installment",
      installments: 3
    });
    expect(res.statusCode, res.payload).toBe(200);

    const total = 1500 + loanFee(1500, installmentTermDays(3));
    const schedule = installmentSchedule(total, 3);
    const loanId = res.json().loan.id as string;
    expect(res.json().loan).toMatchObject({ plan: "installment", installmentCount: 3, repaymentAmount: total });
    expect(res.json().repayment).toMatchObject({ amount: schedule[0], installmentNumber: 1, installmentsTotal: 3 });

    // Pay installment 1 and 2 — loan stays open.
    let r = await repay(app, token, loanId);
    expect(r.json()).toMatchObject({ loanStatus: "disbursed", payment: { amount: schedule[0] } });
    r = await repay(app, token, loanId);
    expect(r.json()).toMatchObject({ loanStatus: "disbursed", payment: { amount: schedule[1] } });

    // Final installment closes the loan.
    r = await repay(app, token, loanId);
    expect(r.json()).toMatchObject({ loanStatus: "repaid", payment: { amount: schedule[2] } });
  });

  it("rejects installment plans below the minimum amount", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const res = await applyLoan(app, token, { amount: 500, purpose: "Transport", expectedRepaymentDate: TERM_DATE, repaymentPlan: "installment", installments: 2 });
    expect(res.statusCode).toBe(400);
  });
});

describe("PulaCash API — admin & webhooks", () => {
  it("lets admins approve a pending loan (term-scaled fee)", async () => {
    const app = await createApp();
    const adminToken = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const [application] = (await app.inject({ method: "GET", url: "/admin/loan-applications", headers: auth(adminToken) })).json();
    const res = await app.inject({ method: "POST", url: `/admin/loans/${application.id}/approve`, headers: auth(adminToken) });
    expect(res.statusCode, res.payload).toBe(200);
    const loan = res.json().loan;
    expect(loan).toMatchObject({ amount: 600, status: "disbursed" });
    expect(loan.repaymentAmount).toBe(loan.amount + loan.fee);
    expect(computeApr(loan.fee, loan.amount, 62)).toBeLessThan(0.36);
  });

  it("blocks student access to the admin dashboard", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    expect((await app.inject({ method: "GET", url: "/admin/dashboard", headers: auth(token) })).statusCode).toBe(403);
  });

  it("rejects an unsigned payment webhook", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "POST", url: "/webhooks/payments", payload: { reference: "sim_repayment_x", status: "settled" } });
    expect(res.statusCode).toBe(401);
  });
});

describe("PulaCash API — access control (IDOR)", () => {
  it("prevents a student from reading another student's loan", async () => {
    const app = await createApp();
    const alice = await onboardVerifiedStudent(app, "alice@ub.ac.bw");
    const applied = await applyLoan(app, alice.token, { amount: 300, purpose: "Transport", expectedRepaymentDate: TERM_DATE });
    const loanId = applied.json().loan.id as string;
    const bob = await onboardVerifiedStudent(app, "bob@ub.ac.bw");

    expect((await app.inject({ method: "GET", url: `/loans/${loanId}`, headers: auth(bob.token) })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `/loans/${loanId}`, headers: auth(alice.token) })).statusCode).toBe(200);
  });
});

describe("PulaCash API — feedback board", () => {
  it("posts (no author PII), lists, toggles votes, and only the author can delete", async () => {
    const app = await createApp();
    const a = await onboardVerifiedStudent(app, "amy@ub.ac.bw");
    const b = await onboardVerifiedStudent(app, "ben@ub.ac.bw");

    const post = await app.inject({ method: "POST", url: "/feedback", headers: auth(a.token), payload: { category: "feature", message: "Please add dark mode" } });
    expect(post.statusCode, post.payload).toBe(200);
    const fid = post.json().id as string;
    // First-name only; no email, no user id leaked.
    expect(post.json().authorName).toBe("Onboarded");
    expect(JSON.stringify(post.json())).not.toContain("@ub.ac.bw");
    expect(post.json()).not.toHaveProperty("userId");

    const list = await app.inject({ method: "GET", url: "/feedback", headers: auth(b.token) });
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].isMine).toBe(false);

    // B upvotes, then toggles off.
    expect((await app.inject({ method: "POST", url: `/feedback/${fid}/vote`, headers: auth(b.token) })).json()).toMatchObject({ voteCount: 1, hasVoted: true });
    expect((await app.inject({ method: "POST", url: `/feedback/${fid}/vote`, headers: auth(b.token) })).json()).toMatchObject({ voteCount: 0, hasVoted: false });

    // B cannot delete A's post; A can.
    expect((await app.inject({ method: "DELETE", url: `/feedback/${fid}`, headers: auth(b.token) })).statusCode).toBe(403);
    expect((await app.inject({ method: "DELETE", url: `/feedback/${fid}`, headers: auth(a.token) })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/feedback", headers: auth(a.token) })).json()).toHaveLength(0);
  });

  it("requires authentication to view the board", async () => {
    const app = await createApp();
    expect((await app.inject({ method: "GET", url: "/feedback" })).statusCode).toBe(401);
  });
});
