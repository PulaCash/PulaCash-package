import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

const studentToken = "demo-student-token";
const adminToken = "demo-admin-token";
const studentAuth = { authorization: `Bearer ${studentToken}` };
const adminAuth = { authorization: `Bearer ${adminToken}` };

describe("PulaCash API", () => {
  it("returns the student dashboard for a verified student", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/student/dashboard",
      headers: studentAuth
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      student: {
        name: "Thatayotlhe Tsenang",
        verificationStatus: "verified"
      },
      borrowing: {
        available: 350
      }
    });
  });

  it("validates institutional student emails", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "student@gmail.com",
        fullName: "Demo Student",
        password: "password123"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("approved student email");
  });

  it("lets admins approve a pending loan application", async () => {
    const app = await createApp();
    const applicationsResponse = await app.inject({
      method: "GET",
      url: "/admin/loan-applications",
      headers: adminAuth
    });
    const [application] = applicationsResponse.json();

    const response = await app.inject({
      method: "POST",
      url: `/admin/loans/${application.id}/approve`,
      headers: adminAuth
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().loan).toMatchObject({
      amount: 600,
      repaymentAmount: 690,
      status: "disbursed"
    });
  });

  it("auto-approves and disburses a loan instantly", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: studentAuth,
      payload: {
        amount: 600,
        purpose: "Transport",
        expectedRepaymentDate: "2026-07-31",
        acceptedTerms: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "disbursed",
      loan: { amount: 600, repaymentAmount: 690, status: "disbursed" }
    });
  });

  it("routes loans above the hidden cap to admin review", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/loans/apply",
      headers: studentAuth,
      payload: {
        amount: 5000,
        purpose: "Transport",
        expectedRepaymentDate: "2026-08-31",
        acceptedTerms: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "pending_review",
      application: { amount: 5000, status: "pending_review" }
    });
  });

  it("registers, emails a code, and verifies it", async () => {
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

  it("blocks student access to admin dashboard", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/admin/dashboard",
      headers: studentAuth
    });

    expect(response.statusCode).toBe(403);
  });
});
