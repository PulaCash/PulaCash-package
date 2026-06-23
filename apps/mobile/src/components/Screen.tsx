import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { Edge, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { gradients } from "../theme/tokens";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  gradient?: "soft" | "brand";
  padded?: boolean;
  /** Which edges the safe area should pad. Drop "bottom" for full-bleed panels. */
  edges?: Edge[];
  /** Reserve space at the bottom for the floating tab bar (student screens). */
  tabBar?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// Floating tab bar height defined in app/(student)/_layout.tsx.
const TAB_BAR_HEIGHT = 60;

export function Screen({
  children,
  scroll = true,
  gradient = "soft",
  padded = true,
  edges = ["top", "left", "right", "bottom"],
  tabBar = true,
  contentContainerStyle
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // Clear the floating tab bar (height + its lifted bottom offset) plus breathing room.
  const bottomInset = tabBar ? TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 24 : 24;

  const content = scroll ? (
    <ScrollView
      className={padded ? "px-5" : ""}
      contentContainerStyle={[{ paddingBottom: bottomInset }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={padded ? "flex-1 px-5" : "flex-1"}>{children}</View>
  );

  return (
    <LinearGradient
      colors={gradient === "brand" ? gradients.brand : gradients.soft}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1" edges={edges}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          {content}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
