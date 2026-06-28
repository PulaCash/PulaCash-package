import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const ADMIN_EMAIL = "tsenangthatayotlhe04@gmail.com";
const ADMIN_PASSWORD = "PulaCashAdmin!2026";
const DEMO_EMAIL = "demo.student@ub.ac.bw";
const DEMO_PASSWORD = "DemoStudent!2026";

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const TERM_DATE = futureDate(65); // satisfies the >=62-day minimum term

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

/** Register → verify email → profile → upload ID → admin verifies. Returns a borrow-ready token. */
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
    payload: { fileName: "id.png", mimeType: "image/png", sizeBytes: 5000 }
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
    const out = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { ...auth(token), "content-type": "application/json" },
      payload: ""
    });
    expect(out.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
  });
});

describe("PulaCash API — password reset", () => {
  it("resets the password with an emailed code and revokes old sessions", async () => {
    const app = await createApp();
    const oldToken = await login(app, DEMO_EMAIL, DEMO_PASSWORD);

    const req = await app.inject({ method: "POST", url: "/auth/request-password-reset", payload: { email: DEMO_EMAIL } });
    expect(req.statusCode).toBe(200);
    const code = req.json().demoResetCode as string;
    expect(code).toMatch(/^\d{6}$/);

    const reset = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { email: DEMO_EMAIL, code, newPassword: "brand-new-pass-1" }
    });
    expect(reset.statusCode).toBe(200);

    // New password works, old password fails, and the pre-reset session is dead.
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: DEMO_EMAIL, password: "brand-new-pass-1" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/auth/login", payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(oldToken) })).statusCode).toBe(401);
  });

  it("does not reveal whether an email exists", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "POST", url: "/auth/request-password-reset", payload: { email: "nobody@ub.ac.bw" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().demoResetCode).toBeUndefined();
  });
});

describe("PulaCash API — account deletion", () => {
  it("deletes an account after re-authentication and frees the email", async () => {
    const app = await createApp();
    const email = "deletes.me@ub.ac.bw";
    const { token } = await onboardVerifiedStudent(app, email);

    expect((await app.inject({ method: "POST", url: "/account/delete", headers: auth(token), payload: { password: "wrongpass1", confirm: true } })).statusCode).toBe(401);

    const del = await app.inject({ method: "POST", url: "/account/delete", headers: auth(token), payload: { password: "password123", confirm: true } });
    expect(del.statusCode).toBe(200);

    // Session is revoked and the email can be registered again.
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/auth/register", payload: { email, fullName: "Reused Email", password: "password123" } })).statusCode).toBe(200);
  });
});

describe("PulaCash API — loans, APR & server-side settlement", () => {
  it("disburses at a 3% fee with a compliant APR (<=36%) over a >=62-day term", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const res = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE, acceptedTerms: true }
    });
    expect(res.statusCode, res.payload).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: "disbursed", loan: { amount: 600, fee: 18, repaymentAmount: 618 }, payment: { status: "settled" } });

    // APR = fee/principal * 365/termDays must be under Apple's 36% cap.
    const apr = (18 / 600) * (365 / 65);
    expect(apr).toBeLessThanOrEqual(0.36);
  });

  it("rejects a term shorter than the 62-day minimum", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const res = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 300, purpose: "Transport", expectedRepaymentDate: futureDate(30), acceptedTerms: true }
    });
    expect(res.statusCode).toBe(400);
  });

  it("computes the repayment server-side — the client cannot under-pay to clear a loan", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const applied = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE, acceptedTerms: true }
    });
    const loanId = applied.json().loan.id as string;

    // Even if a client tries to send amount: 1, the schema strips it and the server
    // charges the full P618; the loan is only repaid once the payment settles.
    const repay = await app.inject({
      method: "POST",
      url: "/repayments/initiate",
      headers: auth(token),
      payload: { loanId, method: "orange_money", amount: 1 }
    });
    expect(repay.statusCode, repay.payload).toBe(200);
    expect(repay.json()).toMatchObject({ loanStatus: "repaid", payment: { amount: 618, status: "settled" } });

    const loan = (await app.inject({ method: "GET", url: `/loans/${loanId}`, headers: auth(token) })).json();
    expect(loan.status).toBe("repaid");
  });

  it("rejects loan amounts above the hard P2,000 cap", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const res = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 5000, purpose: "Transport", expectedRepaymentDate: TERM_DATE, acceptedTerms: true }
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PulaCash API — membership tiers & subscription", () => {
  it("caps free borrowers at P500 and lifts the cap after subscribing to PulaCash+", async () => {
    const app = await createApp();
    const email = "free.tier@ub.ac.bw";
    const { token } = await onboardVerifiedStudent(app, email); // free tier by default

    const overFree = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE, acceptedTerms: true }
    });
    expect(overFree.statusCode).toBe(403);

    const sub = await app.inject({
      method: "POST",
      url: "/subscriptions/subscribe",
      headers: auth(token),
      payload: { tier: "plus", paymentMethod: "orange_money" }
    });
    expect(sub.statusCode, sub.payload).toBe(200);
    expect(sub.json().user.subscriptionTier).toBe("plus");

    const nowAllowed = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 600, purpose: "Transport", expectedRepaymentDate: TERM_DATE, acceptedTerms: true }
    });
    expect(nowAllowed.statusCode, nowAllowed.payload).toBe(200);
    expect(nowAllowed.json().status).toBe("disbursed");
  });
});

describe("PulaCash API — admin & webhooks", () => {
  it("lets admins approve a pending loan at the 3% fee", async () => {
    const app = await createApp();
    const adminToken = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const [application] = (await app.inject({ method: "GET", url: "/admin/loan-applications", headers: auth(adminToken) })).json();
    const res = await app.inject({ method: "POST", url: `/admin/loans/${application.id}/approve`, headers: auth(adminToken) });
    expect(res.statusCode, res.payload).toBe(200);
    expect(res.json().loan).toMatchObject({ amount: 600, repaymentAmount: 618, status: "disbursed" });
  });

  it("blocks student access to the admin dashboard", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    expect((await app.inject({ method: "GET", url: "/admin/dashboard", headers: auth(token) })).statusCode).toBe(403);
  });

  it("rejects an unsigned payment webhook", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/payments",
      payload: { reference: "sim_repayment_x", status: "settled" }
    });
    expect(res.statusCode).toBe(401);
  });
});
