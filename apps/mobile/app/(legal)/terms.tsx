import { LegalDoc } from "@/components/LegalDoc";

export default function TermsScreen() {
  return (
    <LegalDoc
      title="Terms of Use"
      intro="These Terms of Use govern your access to and use of the PulaCash mobile application and services. By creating an account or using PulaCash you agree to these terms. PulaCash provides short-term emergency microloans to verified students enrolled at recognised institutions in Botswana."
      sections={[
        {
          heading: "Eligibility",
          body: "You must be at least 18 years old, a currently enrolled student at a recognised Botswana institution, and able to enter into a binding contract under Botswana law. You must register with your institutional student email and complete identity verification before borrowing."
        },
        {
          heading: "Account & two-step verification",
          body: "Access requires a verified student email (a one-time code) and a verified student ID document reviewed by PulaCash. You are responsible for keeping your password and device secure and for all activity under your account. Notify us immediately of any unauthorised use."
        },
        {
          heading: "Loans, fees & repayment",
          body: "Each approved loan carries a fixed service fee disclosed in full before you accept. The total repayment amount and due date are shown on the loan agreement screen before submission. You agree to repay the total amount by the due date. Late or missed repayments may reduce your reliability score and affect future eligibility."
        },
        {
          heading: "Responsible lending",
          body: "PulaCash lends only within published limits and only to verified students. We may decline, reduce, or place any application under manual review at our discretion. Borrowing is optional and should be used for genuine short-term needs."
        },
        {
          heading: "Acceptable use",
          body: "You agree not to provide false information, attempt to bypass verification, access another person's account, probe or attack the service, or use PulaCash for any unlawful purpose. We may suspend or close accounts that breach these terms."
        },
        {
          heading: "Account deletion",
          body: "You may request deletion of your PulaCash account and associated personal data by contacting us. Outstanding loan obligations and records we are legally required to retain may survive account closure."
        },
        {
          heading: "Disclaimers & liability",
          body: "PulaCash is provided on an 'as is' basis. To the extent permitted by law, we are not liable for indirect or consequential losses. Nothing in these terms excludes liability that cannot be excluded under Botswana law."
        },
        {
          heading: "Changes to these terms",
          body: "We may update these terms from time to time. Material changes will be communicated in-app. Continued use after changes take effect constitutes acceptance."
        }
      ]}
    />
  );
}
