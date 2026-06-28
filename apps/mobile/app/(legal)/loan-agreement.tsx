import { LegalDoc } from "@/components/LegalDoc";

export default function LoanAgreementScreen() {
  return (
    <LegalDoc
      title="Loan Agreement"
      intro="This Loan Agreement sets out the terms on which PulaCash provides a short-term emergency microloan to you, the borrower. The specific amount, service fee, representative APR, total repayment, and due date for your loan are displayed on the application screen before you accept. By accepting, you agree to the following."
      sections={[
        {
          heading: "The loan",
          body: "PulaCash agrees to disburse the principal amount you request, up to your available limit, once your application is approved. A single service fee is added to the principal to form the total repayment amount; the exact fee, the representative APR, and the total are all shown before you accept. There are no separate hidden charges on the disclosed amount."
        },
        {
          heading: "Cost of credit (APR)",
          body: "The representative annual percentage rate (APR), including all fees, is shown before you accept and never exceeds 36%. The minimum loan term is 62 days; we never require full repayment in 60 days or less. The fee scales with the term, so a longer plan carries a larger total fee at a comparable APR."
        },
        {
          heading: "Repayment plans",
          body: "Loans are repaid either in a single payment by the due date, or — for eligible PulaCash+ members on larger loans — in equal monthly installments. The schedule, amounts, and due dates are shown before you accept. The amount charged for each payment is computed by PulaCash from your loan and collected through licensed payment rails — never entered on your device."
        },
        {
          heading: "Repayment & reliability",
          body: "You agree to repay the total in full by the due date(s) shown (the term is at least 62 days from disbursement). Repaying on time increases your reliability score and unlocks higher limits; late or missed repayment lowers it and may make you ineligible for future loans."
        },
        {
          heading: "Eligibility & verification",
          body: "Disbursement is conditional on your student email being verified and your student ID being reviewed and verified by PulaCash. PulaCash may decline or place any application under manual review."
        },
        {
          heading: "Default",
          body: "If you do not repay by the due date, the loan is in default. PulaCash may suspend your borrowing, adjust your reliability score, and pursue recovery of amounts owed as permitted by Botswana law. We will always seek to engage with you first."
        },
        {
          heading: "Cancellation",
          body: "Lending is optional. If you do not accept these terms, do not submit the application. Once a loan is disbursed, the repayment obligation applies."
        }
      ]}
    />
  );
}
