import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { AtSign, LockKeyhole, Mail } from "lucide-react-native";
import { ReactNode, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { ApiError, requestPasswordReset, resetPassword } from "@/lib/api";
import { colors, control, iconSize, radius } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<0 | 1>(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");

  const request = useMutation({
    mutationFn: () => requestPasswordReset(email.trim().toLowerCase()),
    onSuccess: (res) => {
      setError(null);
      if (res.demoResetCode) setCode(res.demoResetCode);
      setStep(1);
    },
    onError: fail
  });

  const reset = useMutation({
    mutationFn: () => resetPassword({ email: email.trim().toLowerCase(), code: code.trim(), newPassword }),
    onSuccess: () => {
      setError(null);
      router.replace("/login");
    },
    onError: fail
  });

  return (
    <Screen tabBar={false}>
      <TopBar back title="Reset password" />
      {step === 0 ? (
        <>
          <Text className="text-4xl font-extrabold text-pula-ink">Forgot password?</Text>
          <Text className="mt-3 text-base leading-6 text-pula-muted">
            Enter your account email and we'll send you a 6-digit reset code.
          </Text>
          <GlassCard className="mt-8" contentClassName="gap-4">
            <Field icon={<AtSign color={colors.blue} size={iconSize.md} />} placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            {error ? <Text className="text-sm font-semibold text-red-500">{error}</Text> : null}
            {request.isPending ? (
              <Loader />
            ) : (
              <GradientButton label="Send reset code" disabled={!/\S+@\S+\.\S+/.test(email)} onPress={() => request.mutate()} />
            )}
          </GlassCard>
        </>
      ) : (
        <>
          <Text className="text-4xl font-extrabold text-pula-ink">Set a new password</Text>
          <Text className="mt-3 text-base leading-6 text-pula-muted">Enter the code sent to {email} and choose a new password.</Text>
          <GlassCard className="mt-8" contentClassName="gap-4">
            <Field icon={<Mail color={colors.blue} size={iconSize.md} />} placeholder="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" />
            <Field icon={<LockKeyhole color={colors.blue} size={iconSize.md} />} placeholder="New password (min 8)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            {error ? <Text className="text-sm font-semibold text-red-500">{error}</Text> : null}
            {reset.isPending ? (
              <Loader />
            ) : (
              <GradientButton label="Update password" disabled={!/^\d{6}$/.test(code) || newPassword.length < 8} onPress={() => reset.mutate()} />
            )}
          </GlassCard>
        </>
      )}
    </Screen>
  );
}

function Loader() {
  return (
    <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
      <ActivityIndicator color={colors.white} />
    </View>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType
}: {
  icon: ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad";
}) {
  return (
    <View className="h-14 flex-row items-center bg-pula-mist px-4" style={{ borderRadius: radius.md }}>
      {icon}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8B96A8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        className="ml-3 flex-1 text-base font-semibold text-pula-ink"
      />
    </View>
  );
}
