import { Bell, ChevronLeft, Search } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { colors, glass, iconSize, radius, shadows } from "../theme/tokens";
import { GlassSurface } from "./glass/Glass";

type TopBarProps = {
  title?: string;
  back?: boolean;
  search?: boolean;
  bell?: boolean;
  pill?: boolean;
};

const ICON_BUTTON = 48;

export function TopBar({ title, back = false, search = false, bell = false, pill = false }: TopBarProps) {
  const rightIcon = search ? (
    <Search color={colors.ink} size={iconSize.md} />
  ) : bell ? (
    <Bell color={colors.ink} size={iconSize.md} />
  ) : null;

  return (
    <View className="mb-5 mt-2 flex-row items-center justify-between">
      {back ? (
        <GlassIconButton onPress={() => router.back()}>
          <ChevronLeft color={colors.ink} size={iconSize.md} />
        </GlassIconButton>
      ) : (
        <View style={{ width: ICON_BUTTON, height: ICON_BUTTON }} />
      )}

      {title ? (
        <View className={pill ? "rounded-full bg-pula-mist px-5 py-2" : ""}>
          <Text className={pill ? "text-sm font-extrabold text-pula-blue" : "text-xl font-extrabold text-pula-ink"}>{title}</Text>
        </View>
      ) : (
        <View />
      )}

      {rightIcon ? <GlassIconButton>{rightIcon}</GlassIconButton> : <View style={{ width: ICON_BUTTON, height: ICON_BUTTON }} />}
    </View>
  );
}

function GlassIconButton({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ width: ICON_BUTTON, height: ICON_BUTTON, borderRadius: radius.pill, ...shadows.soft }}
    >
      <GlassSurface
        effect="regular"
        tint="rgba(255,255,255,0.45)"
        interactive
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: glass.border
        }}
        fallbackIntensity={glass.intensity}
        fallbackFill={glass.tintStrong}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
