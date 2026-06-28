import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { AtSign, LockKeyhole } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { authLoginSchema } from "@pulacash/shared";
import { z } from "zod";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { ApiError, signIn } from "@/lib/api";
import { colors, control, iconSize, radius } from "@/theme/tokens";

type LoginForm = z.infer<typeof authLoginSchema>;

export default function LoginScreen() {
  const queryClient = useQueryClient();
  const { control: form, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(authLoginSchema),
    defaultValues: { email: "", password: "" }
  });

  const login = useMutation({
    mutationFn: signIn,
    onSuccess: async (data) => {
      await queryClient.invalidateQueries();
      if (data.user.role === "admin") {
        router.replace("/admin");
      } else if (!data.user.emailVerified) {
        router.replace("/confirm-email");
      } else {
        router.replace("/home");
      }
    }
  });

  const errorMessage =
    login.error instanceof ApiError ? login.error.message : login.error ? "Something went wrong. Try again." : null;

  return (
    <Screen tabBar={false}>
      <TopBar back title="Sign in" />
      <Text className="text-4xl font-extrabold text-pula-ink">Welcome back</Text>
      <Text className="mt-3 text-base leading-6 text-pula-muted">Sign in with your PulaCash account to continue.</Text>

      <GlassCard className="mt-8" contentClassName="gap-4">
        <Field
          control={form}
          name="email"
          icon={<AtSign color={colors.blue} size={iconSize.md} />}
          placeholder="Student or admin email"
          keyboardType="email-address"
          autoCapitalize="none"
          error={formState.errors.email?.message}
        />
        <Field
          control={form}
          name="password"
          icon={<LockKeyhole color={colors.blue} size={iconSize.md} />}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          error={formState.errors.password?.message}
        />

        {errorMessage ? <Text className="text-sm font-semibold text-red-500">{errorMessage}</Text> : null}

        {login.isPending ? (
          <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <GradientButton label="Sign in" onPress={handleSubmit((values) => login.mutate(values))} />
        )}

        <Pressable className="items-center" onPress={() => router.push("/forgot-password")}>
          <Text className="text-sm font-extrabold text-pula-blue">Forgot password?</Text>
        </Pressable>
      </GlassCard>

      <Pressable className="mt-6 flex-row justify-center" onPress={() => router.replace("/onboarding")}>
        <Text className="text-base text-pula-muted">New student? </Text>
        <Text className="text-base font-extrabold text-pula-blue">Create an account</Text>
      </Pressable>

      <View className="mt-3 flex-row justify-center gap-1">
        <Pressable onPress={() => router.push("/terms")}>
          <Text className="text-xs font-semibold text-pula-muted underline">Terms of Use</Text>
        </Pressable>
        <Text className="text-xs text-pula-muted">·</Text>
        <Pressable onPress={() => router.push("/privacy")}>
          <Text className="text-xs font-semibold text-pula-muted underline">Privacy Policy</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

type FieldProps = {
  control: ReturnType<typeof useForm<LoginForm>>["control"];
  name: keyof LoginForm;
  icon: React.ReactNode;
  placeholder: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoCapitalize?: "none" | "sentences";
};

function Field({ control, name, icon, placeholder, error, secureTextEntry, keyboardType, autoCapitalize }: FieldProps) {
  return (
    <View>
      <View className="h-14 flex-row items-center bg-pula-mist px-4" style={{ borderRadius: radius.md }}>
        {icon}
        <Controller
          control={control}
          name={name}
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder={placeholder}
              placeholderTextColor="#8B96A8"
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoCorrect={false}
              className="ml-3 flex-1 text-base font-semibold text-pula-ink"
            />
          )}
        />
      </View>
      {error ? <Text className="mt-1.5 text-sm font-semibold text-red-500">{error}</Text> : null}
    </View>
  );
}
