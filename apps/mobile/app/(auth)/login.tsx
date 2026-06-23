import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ShieldCheck, WalletCards } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { continueAsDemoStudent } from "@/lib/api";
import { demoDashboard, demoUser } from "@/lib/demo-data";
import { colors, control, iconSize, radius } from "@/theme/tokens";

export default function LoginScreen() {
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: continueAsDemoStudent,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.replace("/home");
    }
  });

  return (
    <Screen tabBar={false}>
      <TopBar back title="Sign in" />
      <Text className="text-4xl font-extrabold text-pula-ink">Welcome back</Text>
      <Text className="mt-3 text-base leading-6 text-pula-muted">Continue with the seeded student profile.</Text>
      <GlassCard className="mt-8" contentClassName="gap-4">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
            <ShieldCheck color={colors.blue} size={iconSize.md} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-pula-ink">{demoUser.fullName}</Text>
            <Text className="mt-1 text-sm text-pula-muted">Verified {demoDashboard.student.institution} student</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
            <WalletCards color={colors.blue} size={iconSize.md} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-pula-ink">Demo dashboard</Text>
            <Text className="mt-1 text-sm text-pula-muted">Uses seeded app data only</Text>
          </View>
        </View>

        {login.isError ? (
          <Text className="text-sm font-semibold text-red-500">{(login.error as Error).message}</Text>
        ) : null}

        {login.isPending ? (
          <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <GradientButton label="Continue" onPress={() => login.mutate()} />
        )}
      </GlassCard>
    </Screen>
  );
}
