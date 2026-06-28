import { LegalDoc } from "@/components/LegalDoc";

export default function LoanAgreementScreen() {
  return (
    <LegalDoc
      title="Loan Agreement"
      intro="This Loan Agreement sets out the terms on which PulaCash provides a short-term emergency microloan to you, the borrower. The specific amount, service fee, total repayment, and due date for your loan are displayed on the application screen before you accept. By accepting, you agree to the following."
      sections={[
        {
          heading: "The loan",
          body: "PulaCash agrees to disburse the principal amount you request, up to your available limit, once your application is approved. A fixed service fee is added to the principal to form the total repayment amount, all disclosed before you accept. There are no separate hidden charges on the disclosed amount."
        },
        {
          heading: "Repayment",
          body: "You agree to repay the total repayment amount in full by the due date shown. Repaying on or before the due date increases your reliability score and unlocks higher limits over time; late or missed repayment lowers it and may make you ineligible for future loans."
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
