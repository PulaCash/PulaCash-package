import { LegalDoc } from "@/components/LegalDoc";

export default function PrivacyScreen() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="This Privacy Policy explains how PulaCash collects, uses, stores, and protects your personal information. We process personal data in accordance with the Botswana Data Protection Act, 2018. By using PulaCash you consent to the practices described here."
      sections={[
        {
          heading: "Information we collect",
          body: "Account details (full name, student email, password — stored only as a salted hash); profile details (institution, student number, phone number); your uploaded student ID document for verification; and loan, repayment, and reliability-score records generated through your use of the service."
        },
        {
          heading: "How we use your information",
          body: "To verify that you are an enrolled student, assess and process loan applications, manage repayments, calculate your reliability score, prevent fraud and abuse, comply with legal and regulatory obligations, and provide support."
        },
        {
          heading: "Legal basis & consent",
          body: "We process your data to perform our contract with you (providing loans), to comply with legal obligations, for our legitimate interest in preventing fraud, and on the basis of the consent you give when registering and uploading identity documents."
        },
        {
          heading: "Storage & security",
          body: "Passwords are stored only as scrypt hashes and are never recoverable. Session tokens are stored as hashes and expire. Identity documents are held in access-controlled storage. We apply technical and organisational measures to protect your data, though no system is perfectly secure."
        },
        {
          heading: "Sharing & disclosure",
          body: "We do not sell your personal data. We may share data with service providers who help operate PulaCash (e.g. secure storage and email delivery), and with regulators or authorities where required by law, including the relevant non-bank financial regulator."
        },
        {
          heading: "Data retention",
          body: "We keep your data for as long as your account is active and as required to meet legal, regulatory, and audit obligations relating to lending. When no longer required, data is deleted or anonymised."
        },
        {
          heading: "Your rights",
          body: "Subject to the Botswana Data Protection Act, 2018, you may request access to, correction of, or deletion of your personal data, and may withdraw consent. To exercise these rights, contact us using the address below. You may also request deletion of your account in-app."
        },
        {
          heading: "Children",
          body: "PulaCash is intended only for users aged 18 and over. We do not knowingly collect data from anyone under 18."
        }
      ]}
    />
  );
}
