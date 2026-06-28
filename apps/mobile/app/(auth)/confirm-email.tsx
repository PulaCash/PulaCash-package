import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { ApiError, resendVerification, verifyEmailCode } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { colors, control, iconSize, radius } from "@/theme/tokens";

/** Standalone email confirmation for a signed-in account that hasn't verified yet. */
export default function ConfirmEmailScreen() {
  const queryClient = useQueryClient();
  const me = useMe();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const email = me.data?.email ?? "";

  const verify = useMutation({
    mutationFn: () => verifyEmailCode({ email, code: code.trim() }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries();
      router.replace("/home");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong.")
  });

  // Already verified (or signed out) → nothing to confirm here.
  if (me.data && me.data.emailVerified) return <Redirect href="/home" />;
  if (me.isError) return <Redirect href="/welcome" />;

  return (
    <Screen tabBar={false}>
      <TopBar back title="Confirm email" />
      <Text className="text-4xl font-extrabold text-pula-ink">Confirm your email</Text>
      <Text className="mt-3 text-base leading-6 text-pula-muted">
        Enter the 6-digit code we sent to {email || "your student email"}.
      </Text>
      <GlassCard className="mt-8" contentClassName="gap-4">
        <View className="h-14 flex-row items-center bg-pula-mist px-4" style={{ borderRadius: radius.md }}>
          <Mail color={colors.blue} size={iconSize.md} />
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor="#8B96A8"
            keyboardType="number-pad"
            className="ml-3 flex-1 text-base font-semibold text-pula-ink"
          />
        </View>
        {error ? <Text className="text-sm font-semibold text-red-500">{error}</Text> : null}
        {verify.isPending ? (
          <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <GradientButton label="Verify email" disabled={!/^\d{6}$/.test(code)} onPress={() => verify.mutate()} />
        )}
        <Pressable onPress={() => resendVerification().then((r) => r.demoVerificationCode && setCode(r.demoVerificationCode)).catch(() => {})}>
          <Text className="text-sm font-extrabold text-pula-blue">Resend code</Text>
        </Pressable>
      </GlassCard>
    </Screen>
  );
}
