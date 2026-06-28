import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

// Test-env credentials (NODE_ENV=test → admin password falls back to the dev default).
const ADMIN_EMAIL = "tsenangthatayotlhe04@gmail.com";
const ADMIN_PASSWORD = "PulaCashAdmin!2026";
const DEMO_EMAIL = "demo.student@ub.ac.bw";
const DEMO_PASSWORD = "DemoStudent!2026";

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function login(app: Awaited<ReturnType<typeof createApp>>, email: string, password: string) {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  expect(res.statusCode, res.payload).toBe(200);
  return res.json().token as string;
}

async function ubInstitutionId(app: Awaited<ReturnType<typeof createApp>>) {
  const res = await app.inject({ method: "GET", url: "/institutions" });
  return (res.json() as Array<{ id: string; emailDomain: string }>).find((i) => i.emailDomain === "ub.ac.bw")!.id;
}

describe("PulaCash API — authentication", () => {
  it("rejects login when the password is wrong, accepts the right one", async () => {
    const app = await createApp();

    const bad = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: DEMO_EMAIL, password: "not-the-password" }
    });
    expect(bad.statusCode).toBe(401);

    const good = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: DEMO_EMAIL, password: DEMO_PASSWORD }
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().token).toEqual(expect.any(String));
  });

  it("rejects the old hardcoded/predictable bearer tokens", async () => {
    const app = await createApp();
    for (const token of ["demo-admin-token", "demo-student-token", "student-8a287637-708e-4382-b166-57f2d9b18121"]) {
      const res = await app.inject({ method: "GET", url: "/me", headers: auth(token) });
      expect(res.statusCode, `token ${token} must be rejected`).toBe(401);
    }
  });

  it("does not expose the password hash via /me", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const me = await app.inject({ method: "GET", url: "/me", headers: auth(token) });
    expect(me.statusCode).toBe(200);
    const body = me.json();
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty?.("passwordHash");
    expect(JSON.stringify(body)).not.toContain("scrypt$");
  });

  it("revokes the token on logout", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(200);
    await app.inject({ method: "POST", url: "/auth/logout", headers: auth(token) });
    expect((await app.inject({ method: "GET", url: "/me", headers: auth(token) })).statusCode).toBe(401);
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

  it("registers, emails a 6-digit code, and verifies it (with attempt limiting)", async () => {
    const app = await createApp();
    const email = "new.student@ub.ac.bw";
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, fullName: "New Student", password: "password123" }
    });
    expect(reg.statusCode).toBe(200);
    const code = reg.json().demoVerificationCode as string;
    expect(code).toMatch(/^\d{6}$/);

    const bad = await app.inject({ method: "POST", url: "/auth/verify-email", payload: { email, code: "000000" } });
    expect(bad.statusCode).toBe(400);

    const ok = await app.inject({ method: "POST", url: "/auth/verify-email", payload: { email, code } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ verified: true });
  });
});

describe("PulaCash API — verification gate (2FA) before lending", () => {
  it("requires a verified email, then a verified ID, before a loan can be taken", async () => {
    const app = await createApp();
    const email = "gated.student@ub.ac.bw";
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, fullName: "Gated Student", password: "password123" }
    });
    const token = reg.json().token as string;
    const code = reg.json().demoVerificationCode as string;
    const institutionId = await ubInstitutionId(app);

    const profileBody = {
      fullName: "Gated Student",
      studentEmail: email,
      institutionId,
      studentNumber: "UB2026777",
      phoneNumber: "+267 71 000 111"
    };

    // Email not yet verified → cannot create a profile.
    const earlyProfile = await app.inject({ method: "POST", url: "/student/profile", headers: auth(token), payload: profileBody });
    expect(earlyProfile.statusCode).toBe(403);

    await app.inject({ method: "POST", url: "/auth/verify-email", payload: { email, code } });
    const profile = await app.inject({ method: "POST", url: "/student/profile", headers: auth(token), payload: profileBody });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().idStatus).toBe("email_verified");

    const loanBody = { amount: 600, purpose: "Transport", expectedRepaymentDate: "2026-07-31", acceptedTerms: true };

    // Email verified but ID not verified → still blocked.
    const blocked = await app.inject({ method: "POST", url: "/loans/apply", headers: auth(token), payload: loanBody });
    expect(blocked.statusCode).toBe(403);

    // Upload ID (→ id_pending), then admin verifies it (→ verified).
    const upload = await app.inject({
      method: "POST",
      url: "/student/upload-id",
      headers: auth(token),
      payload: { fileName: "student-id.png", mimeType: "image/png", sizeBytes: 12345 }
    });
    expect(upload.statusCode).toBe(200);
    expect(upload.json().status).toBe("id_pending");

    const me = await app.inject({ method: "GET", url: "/me", headers: auth(token) });
    const studentId = me.json().id as string;
    const adminToken = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const verify = await app.inject({
      method: "POST",
      url: `/admin/students/${studentId}/verify-id`,
      headers: auth(adminToken),
      payload: { approved: true }
    });
    expect(verify.statusCode).toBe(200);

    // Now lending is unlocked.
    const ok = await app.inject({ method: "POST", url: "/loans/apply", headers: auth(token), payload: loanBody });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: "disbursed", loan: { amount: 600, repaymentAmount: 750 } });
  });
});

describe("PulaCash API — loans & admin", () => {
  it("returns the student dashboard for a verified student", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const response = await app.inject({ method: "GET", url: "/student/dashboard", headers: auth(token) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      student: { name: "Demo Student", verificationStatus: "verified" },
      borrowing: { available: 600 }
    });
  });

  it("auto-approves and disburses a loan instantly at the 25% fee", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const response = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 600, purpose: "Transport", expectedRepaymentDate: "2026-07-31", acceptedTerms: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disbursed",
      loan: { amount: 600, fee: 150, repaymentAmount: 750, status: "disbursed" }
    });
  });

  it("rejects loan amounts above the hidden P2,000 cap", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const response = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: auth(token),
      payload: { amount: 5000, purpose: "Transport", expectedRepaymentDate: "2026-08-31", acceptedTerms: true }
    });
    expect(response.statusCode).toBe(400);
  });

  it("lets admins approve a pending loan application", async () => {
    const app = await createApp();
    const adminToken = await login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const applicationsResponse = await app.inject({
      method: "GET",
      url: "/admin/loan-applications",
      headers: auth(adminToken)
    });
    const [application] = applicationsResponse.json();

    const response = await app.inject({
      method: "POST",
      url: `/admin/loans/${application.id}/approve`,
      headers: auth(adminToken)
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().loan).toMatchObject({ amount: 600, repaymentAmount: 750, status: "disbursed" });
  });

  it("blocks student access to the admin dashboard", async () => {
    const app = await createApp();
    const token = await login(app, DEMO_EMAIL, DEMO_PASSWORD);
    const response = await app.inject({ method: "GET", url: "/admin/dashboard", headers: auth(token) });
    expect(response.statusCode).toBe(403);
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
    expect((await app.inject({ method: "POST", url: "/loans/apply", payload: {} })).statusCode).toBe(401);
  });
});
