import { describe, expect, it } from "vitest";
import { loanApplySchema } from "@pulacash/shared";
import { demoDashboard, demoLoans } from "../lib/demo-data";

describe("PulaCash mobile flow contracts", () => {
  it("ships with a verified student dashboard state", () => {
    expect(demoDashboard.student.verificationStatus).toBe("verified");
    expect(demoDashboard.borrowing.available).toBeGreaterThan(0);
    expect(demoDashboard.reliability.score).toBeGreaterThanOrEqual(70);
  });

  it("validates the default loan application form", () => {
    const result = loanApplySchema.safeParse({
      amount: 250,
      purpose: "Books and supplies",
      expectedRepaymentDate: "2026-07-15",
      acceptedTerms: true
    });

    expect(result.success).toBe(true);
  });

  it("keeps repayment math explicit in the student UI data", () => {
    const activeLoan = demoLoans[0];
    expect(activeLoan.repaymentAmount).toBe(activeLoan.amount + activeLoan.fee);
  });
});
