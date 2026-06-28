import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, BadgeCheck, ShieldCheck, Zap } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { colors, control, gradients, iconSize, radius, shadows } from "@/theme/tokens";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    // Drop the bottom safe-area edge so the blue panel bleeds to the physical bottom.
    <Screen scroll={false} padded={false} tabBar={false} edges={["top", "left", "right"]}>
      <View className="flex-1">
        <View className="px-10 pb-4 pt-16">
          <Text className="text-5xl font-extrabold text-pula-line">Borrow</Text>
          <Text className="mt-1 text-6xl font-extrabold text-pula-ink">Access</Text>
          <View className="mt-4 h-1.5 w-20 rounded-full bg-pula-cyan" />
          <Text className="mt-4 text-5xl font-extrabold text-pula-line">Build</Text>
        </View>

        <LinearGradient
          colors={gradients.bluePanel}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mt-auto px-8 pt-16"
          style={{
            borderTopLeftRadius: 200,
            borderTopRightRadius: 200,
            marginHorizontal: -38,
            paddingHorizontal: 58,
            // Bleed past the home indicator; keep content above it.
            paddingBottom: insets.bottom + 28
          }}
        >
          <Text className="text-4xl font-extrabold leading-tight text-white">
            Student money,{"\n"}on demand
          </Text>
          <Text className="mt-4 text-base font-medium leading-6 text-white">
            Emergency microloans for students in Botswana
          </Text>

          <View className="mt-8 rounded-[30px] bg-white p-5" style={shadows.soft}>
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
                <Zap color={colors.blue} size={iconSize.md} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-extrabold text-pula-ink">Fast emergency loans</Text>
                <Text className="mt-1 text-sm font-semibold text-pula-muted">Apply once verified — funds on approval</Text>
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
                <BadgeCheck color={colors.blue} size={iconSize.md} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-base font-extrabold text-pula-ink">Two-step verification</Text>
                <Text className="mt-1 text-sm font-semibold text-pula-muted">Student email + ID, students only</Text>
              </View>
            </View>
          </View>

          <View className="mt-8 gap-3">
            <GradientButton label="Sign in" variant="white" onPress={() => router.push("/login")} />
            <Pressable
              accessibilityRole="button"
              className="flex-row items-center justify-center border border-white"
              style={{ height: control.height, borderRadius: radius.lg, paddingHorizontal: 20 }}
              onPress={() => router.push("/onboarding")}
            >
              <Text className="text-base font-medium text-white">New student? </Text>
              <Text className="text-base font-extrabold text-white">Create account</Text>
              <ArrowRight color={colors.white} size={iconSize.sm} strokeWidth={2.4} style={{ marginLeft: 6 }} />
            </Pressable>
          </View>

          <View className="mt-7 flex-row items-center justify-center">
            <ShieldCheck color={colors.white} size={iconSize.sm} />
            <Text className="ml-2 text-sm font-semibold text-white">Verified student access only</Text>
          </View>
        </LinearGradient>
      </View>
    </Screen>
  );
}
