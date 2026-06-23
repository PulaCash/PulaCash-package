import { Image, Text, View } from "react-native";
import { colors, shadows } from "../theme/tokens";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View className={compact ? "flex-row items-center gap-3" : "items-center gap-4"}>
      <Image
        source={require("../../assets/icon.png")}
        className={compact ? "h-12 w-12 rounded-2xl" : "h-24 w-24 rounded-[28px]"}
        style={shadows.soft}
      />
      <Text
        className={compact ? "text-2xl font-extrabold" : "text-5xl font-extrabold"}
        style={{ color: colors.white }}
      >
        PulaCash
      </Text>
    </View>
  );
}
