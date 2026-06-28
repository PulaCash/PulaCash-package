import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  Check,
  CheckCircle2,
  IdCard,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound
} from "lucide-react-native";
import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { studentProfileSchema, type StudentProfileInput } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { ApiError, apiFetch, resendVerification, signUp, verifyEmailCode } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { colors, control, iconSize, radius, shadows } from "@/theme/tokens";

type Institution = { id: string; name: string; emailDomain: string };
const TOTAL_STEPS = 5;

export default function OnboardingScreen() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  // Form state, gathered across steps.
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  const institutions = useQuery({
    queryKey: ["institutions"],
    queryFn: () => apiFetch<Institution[]>(endpoints.institutions),
    initialData: []
  });

  const fail = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");

  // Step 0 → register the account.
  const register = useMutation({
    mutationFn: () => signUp({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password }),
    onSuccess: (res) => {
      setError(null);
      if (res.demoVerificationCode) setCode(res.demoVerificationCode);
      setStep(1);
    },
    onError: fail
  });

  // Step 1 → confirm the emailed code.
  const verify = useMutation({
    mutationFn: () => verifyEmailCode({ email: email.trim().toLowerCase(), code: code.trim() }),
    onSuccess: () => {
      setError(null);
      setStep(2);
    },
    onError: fail
  });

  // Step 2 → save the student profile.
  const saveProfile = useMutation({
    mutationFn: () => {
      const input: StudentProfileInput = {
        fullName: fullName.trim(),
        studentEmail: email.trim().toLowerCase(),
        institutionId,
        studentNumber: studentNumber.trim(),
        phoneNumber: phoneNumber.trim()
      };
      const parsed = studentProfileSchema.safeParse(input);
      if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Check your details.", 400);
      return apiFetch(endpoints.student.profile, { method: "POST", body: JSON.stringify(parsed.data) });
    },
    onSuccess: () => {
      setError(null);
      setStep(3);
    },
    onError: fail
  });

  // Step 3 → upload the student ID document (KYC). Admin then verifies it.
  const uploadId = useMutation({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true
      });
      if (picked.canceled || !picked.assets?.[0]) return null;
      const asset = picked.assets[0];
      const mimeType = ["image/jpeg", "image/png", "application/pdf"].includes(asset.mimeType ?? "")
        ? (asset.mimeType as string)
        : "image/jpeg";
      const meta = {
        fileName: asset.name?.slice(0, 180) || `student-id-${Date.now()}.jpg`,
        mimeType,
        sizeBytes: Math.max(1, Math.min(asset.size ?? 100000, 5_000_000))
      };
      const target = await apiFetch<{ uploadUrl: string | null }>(endpoints.student.uploadId, {
        method: "POST",
        body: JSON.stringify(meta)
      });
      // When storage is configured the server returns a signed URL; push the bytes.
      if (target.uploadUrl) {
        const file = await fetch(asset.uri);
        const blob = await file.blob();
        await fetch(target.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": mimeType } }).catch(
          () => undefined
        );
      }
      return target;
    },
    onSuccess: (result) => {
      if (result === null) return; // user cancelled the picker
      setError(null);
      setStep(4);
    },
    onError: fail
  });

  async function finish() {
    await queryClient.invalidateQueries();
    router.replace("/home");
  }

  const canRegister = fullName.trim().length >= 2 && /\S+@\S+\.\S+/.test(email) && password.length >= 8 && agreed;
  const registerHint = !agreed && fullName && email && password ? "Accept the terms to continue." : null;

  return (
    <Screen tabBar={false} contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 pb-2 pt-3">
        <Header step={step} onBack={() => (step === 0 ? router.back() : setStep((s) => Math.max(0, s - 1)))} />

        {step === 0 ? (
          <StepBody title="Create your account" body="Sign up with your institutional student email to join PulaCash.">
            <GlassCard contentClassName="gap-4">
              <Field icon={<UserRound color={colors.blue} size={iconSize.md} />} placeholder="Full name" value={fullName} onChangeText={setFullName} />
              <Field icon={<AtSign color={colors.blue} size={iconSize.md} />} placeholder="Student email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <Field icon={<LockKeyhole color={colors.blue} size={iconSize.md} />} placeholder="Password (min 8 characters)" value={password} onChangeText={setPassword} secureTextEntry />
              <Pressable className="flex-row items-center gap-3" onPress={() => setAgreed((v) => !v)}>
                <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: agreed ? colors.blue : colors.line }}>
                  {agreed ? <Check color={colors.white} size={iconSize.sm} /> : null}
                </View>
                <Text className="flex-1 text-sm leading-5 text-pula-muted">
                  I agree to the{" "}
                  <Text className="font-extrabold text-pula-blue" onPress={() => router.push("/terms")}>Terms of Use</Text>
                  {" "}and{" "}
                  <Text className="font-extrabold text-pula-blue" onPress={() => router.push("/privacy")}>Privacy Policy</Text>.
                </Text>
              </Pressable>
            </GlassCard>
            <PrimaryAction
              label="Create account"
              loading={register.isPending}
              disabled={!canRegister}
              onPress={() => register.mutate()}
              error={error ?? registerHint}
            />
          </StepBody>
        ) : null}

        {step === 1 ? (
          <StepBody title="Confirm your email" body={`Enter the 6-digit code we sent to ${email}.`}>
            <GlassCard contentClassName="gap-4">
              <Field icon={<Mail color={colors.blue} size={iconSize.md} />} placeholder="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" />
              <Pressable onPress={() => resendVerification().then((r) => r.demoVerificationCode && setCode(r.demoVerificationCode)).catch(() => {})}>
                <Text className="text-sm font-extrabold text-pula-blue">Resend code</Text>
              </Pressable>
            </GlassCard>
            <PrimaryAction label="Verify email" loading={verify.isPending} disabled={!/^\d{6}$/.test(code)} onPress={() => verify.mutate()} error={error} />
          </StepBody>
        ) : null}

        {step === 2 ? (
          <StepBody title="Your student profile" body="Tell us where you study so we can verify your enrolment.">
            <GlassCard contentClassName="gap-3">
              <Text className="text-sm font-bold uppercase text-pula-muted">Institution</Text>
              {institutions.data.map((inst) => {
                const selected = inst.id === institutionId;
                return (
                  <Pressable
                    key={inst.id}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ borderRadius: radius.md, backgroundColor: selected ? colors.blueSoft : colors.mist, borderWidth: 1, borderColor: selected ? colors.blue : "transparent" }}
                    onPress={() => setInstitutionId(inst.id)}
                  >
                    <Text className="flex-1 font-semibold" style={{ color: selected ? colors.blue : colors.ink }}>{inst.name}</Text>
                    {selected ? <Check color={colors.blue} size={iconSize.sm} /> : null}
                  </Pressable>
                );
              })}
            </GlassCard>
            <GlassCard className="mt-4" contentClassName="gap-4">
              <Field icon={<IdCard color={colors.blue} size={iconSize.md} />} placeholder="Student number" value={studentNumber} onChangeText={setStudentNumber} />
              <Field icon={<Phone color={colors.blue} size={iconSize.md} />} placeholder="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
            </GlassCard>
            <PrimaryAction
              label="Save profile"
              loading={saveProfile.isPending}
              disabled={!institutionId || studentNumber.trim().length < 4 || phoneNumber.trim().length < 7}
              onPress={() => saveProfile.mutate()}
              error={error}
            />
          </StepBody>
        ) : null}

        {step === 3 ? (
          <StepBody title="Verify your student ID" body="Upload a clear photo or PDF of your student ID card. An admin reviews it before you can borrow.">
            <GlassCard contentClassName="gap-4">
              <SecurityRow icon={<ShieldCheck color={colors.blue} size={iconSize.md} />} title="Secure verification" body="Your document is stored privately" />
              <SecurityRow icon={<LockKeyhole color={colors.blue} size={iconSize.md} />} title="For students only" body="Enrolled at recognised institutions" />
            </GlassCard>
            <PrimaryAction label="Upload ID document" loading={uploadId.isPending} onPress={() => uploadId.mutate()} error={error} />
          </StepBody>
        ) : null}

        {step === 4 ? (
          <StepBody title="You're almost set!" body="Your student ID is being reviewed. You'll be able to apply for a loan once it's verified.">
            <GlassCard>
              <View className="flex-row items-center gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-pula-mist">
                  <CheckCircle2 color={colors.blue} size={28} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-extrabold text-pula-ink">Email verified · ID under review</Text>
                  <Text className="mt-1 text-sm leading-5 text-pula-muted">Two-step verification keeps PulaCash students-only.</Text>
                </View>
              </View>
            </GlassCard>
            <PrimaryAction label="Go to dashboard" onPress={finish} />
          </StepBody>
        ) : null}

        <View className="mt-auto flex-row justify-center gap-2 pt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View key={index} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: index === step ? colors.blue : "#D9E6FB" }} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function Header({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable accessibilityRole="button" className="h-12 w-12 items-center justify-center rounded-full bg-white" style={shadows.soft} onPress={onBack}>
        <ArrowLeft color={colors.blue} size={22} strokeWidth={2.6} />
      </Pressable>
      <View className="rounded-full bg-pula-mist px-5 py-2">
        <Text className="text-sm font-extrabold text-pula-blue">{step + 1} of {TOTAL_STEPS}</Text>
      </View>
      <View className="h-12 w-12" />
    </View>
  );
}

function StepBody({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <View className="pt-6">
      <Text className="text-3xl font-extrabold leading-tight text-pula-ink">{title}</Text>
      <Text className="mt-3 max-w-[320px] text-base leading-6 text-pula-muted">{body}</Text>
      <View className="mt-6">{children}</View>
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
  loading,
  disabled,
  error
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <View className="mt-6">
      {error ? <Text className="mb-3 text-sm font-semibold text-red-500">{error}</Text> : null}
      {loading ? (
        <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <GradientButton label={label} onPress={onPress} disabled={disabled} />
      )}
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
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
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
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        autoCorrect={false}
        className="ml-3 flex-1 text-base font-semibold text-pula-ink"
      />
    </View>
  );
}

function SecurityRow({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-pula-ink">{title}</Text>
        <Text className="mt-1 text-xs font-semibold text-pula-muted">{body}</Text>
      </View>
    </View>
  );
}
