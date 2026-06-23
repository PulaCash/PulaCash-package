import { Text, View } from "react-native";
import { colors } from "../theme/tokens";

export function StatusPill({ label, tone = "blue" }: { label: string; tone?: "blue" | "green" | "amber" | "red" }) {
  const palette = {
    blue: { bg: "#E8F1FF", fg: colors.blue },
    green: { bg: "#E7F9F3", fg: colors.success },
    amber: { bg: "#FFF5DC", fg: colors.warning },
    red: { bg: "#FEECEC", fg: colors.danger }
  }[tone];

  return (
    <View className="self-start rounded-full px-3 py-2" style={{ backgroundColor: palette.bg }}>
      <Text className="text-xs font-bold" style={{ color: palette.fg }}>
        {label}
      </Text>
    </View>
  );
}
