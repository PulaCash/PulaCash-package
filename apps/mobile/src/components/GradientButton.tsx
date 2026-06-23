import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { colors, control, gradients, iconSize, radius, shadows } from "../theme/tokens";

type GradientButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "white" | "outline";
  disabled?: boolean;
  showArrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

// One control height + corner radius for every variant so buttons line up everywhere.
const BASE: ViewStyle = {
  height: control.height,
  borderRadius: radius.lg,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 20
};

export function GradientButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled = false,
  showArrow,
  style
}: GradientButtonProps) {
  const shouldShowArrow = showArrow ?? (variant === "primary" || variant === "white");

  if (variant === "secondary") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        style={[BASE, { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.mist }, disabled ? { opacity: 0.55 } : undefined, style]}
      >
        {icon}
        <Text className="mx-2 text-base font-bold text-pula-blue">{label}</Text>
      </Pressable>
    );
  }

  if (variant === "ghost") {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        style={[BASE, { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white }, disabled ? { opacity: 0.55 } : undefined, style]}
      >
        {icon}
        <Text className="ml-2 text-base font-semibold text-pula-blue">{label}</Text>
      </Pressable>
    );
  }

  if (variant === "white" || variant === "outline") {
    const outline = variant === "outline";
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        disabled={disabled}
        style={[
          BASE,
          {
            backgroundColor: outline ? "rgba(255,255,255,0.08)" : colors.white,
            borderColor: outline ? "rgba(255,255,255,0.72)" : "transparent",
            borderWidth: outline ? 1 : 0
          },
          disabled ? { opacity: 0.55 } : undefined,
          style
        ]}
      >
        {icon}
        <Text className="mx-2 text-base font-extrabold" style={{ color: outline ? colors.white : colors.blue }}>
          {label}
        </Text>
        {shouldShowArrow ? <ChevronRight color={outline ? colors.white : colors.blue} size={iconSize.md} strokeWidth={2.6} /> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[{ height: control.height, borderRadius: radius.lg, overflow: "hidden" }, disabled ? { opacity: 0.55 } : shadows.button, style]}
    >
      <LinearGradient
        colors={disabled ? ["#AFC2E0", "#AFC2E0"] : gradients.button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}
      >
        {icon}
        <Text className="mx-2 text-base font-extrabold text-white">{label}</Text>
        {shouldShowArrow ? (
          <View className="ml-1 h-8 w-8 items-center justify-center rounded-full bg-white">
            <ChevronRight color={colors.blue} size={iconSize.sm} strokeWidth={2.8} />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}
