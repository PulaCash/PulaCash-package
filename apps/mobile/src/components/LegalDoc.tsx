import { Text, View } from "react-native";
import { legal } from "@pulacash/shared";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";

export type LegalSection = { heading: string; body: string };

/** Shared layout for the in-app Terms / Privacy / Loan Agreement screens. */
export function LegalDoc({
  title,
  intro,
  sections
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <Screen tabBar={false}>
      <TopBar back title={title} />
      <Text className="text-3xl font-extrabold text-pula-ink">{title}</Text>
      <Text className="mt-2 text-sm font-semibold text-pula-muted">
        Effective {legal.effectiveDate} · {legal.jurisdiction}
      </Text>
      <Text className="mt-4 text-base leading-6 text-pula-muted">{intro}</Text>

      {sections.map((section, index) => (
        <View key={index} className="mt-6">
          <Text className="text-lg font-extrabold text-pula-ink">
            {index + 1}. {section.heading}
          </Text>
          <Text className="mt-2 text-base leading-6 text-pula-muted">{section.body}</Text>
        </View>
      ))}

      <View className="mt-8 mb-4 rounded-2xl bg-pula-mist p-4">
        <Text className="text-sm leading-5 text-pula-muted">
          These terms are governed by {legal.governingLaw}, with any disputes subject to {legal.venue}. Questions or
          requests: {legal.contactEmail}.
        </Text>
      </View>
    </Screen>
  );
}
