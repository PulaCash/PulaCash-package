import { useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Gift,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound
} from "lucide-react-native";
import { ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { continueAsDemoStudent } from "@/lib/api";
import { demoUser } from "@/lib/demo-data";
import { colors, control, gradients, radius, shadows } from "@/theme/tokens";

const steps = [
  {
    title: "Let's get you started",
    body: "Sign up using your institutional student email to join PulaCash.",
    action: "Continue with student email",
    kind: "start"
  },
  {
    title: "Confirm your student email",
    body: "We've sent a verification link to your student email.",
    action: "I've verified my email",
    kind: "email"
  },
  {
    title: "Verify your student ID",
    body: "Upload a clear photo of your student ID card.",
    action: "Upload ID",
    kind: "id"
  },
  {
    title: "How PulaCash works",
    body: "Short-term help today. Stronger financial future tomorrow.",
    action: "Next",
    kind: "how"
  },
  {
    title: "You're all set!",
    body: "You're now ready to apply for your first emergency microloan.",
    action: "Go to dashboard",
    kind: "done"
  }
] as const;

type StepKind = (typeof steps)[number]["kind"];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const queryClient = useQueryClient();
  const current = steps[step];
  const isFinal = step === steps.length - 1;

  const dots = useMemo(
    () =>
      steps.map((item, index) => (
        <View
          key={item.kind}
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: index === step ? colors.blue : "#D9E6FB" }}
        />
      )),
    [step]
  );

  async function finish() {
    setFinishing(true);
    await continueAsDemoStudent();
    await queryClient.invalidateQueries();
    router.replace("/home");
  }

  async function next() {
    if (isFinal) {
      await finish();
      return;
    }
    setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  return (
    <Screen tabBar={false} contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 pb-2 pt-3">
        <OnboardingHeader step={step} setStep={setStep} />

        <Text className="mt-6 text-3xl font-extrabold leading-tight text-pula-ink">{current.title}</Text>
        <Text className="mt-3 max-w-[300px] text-base leading-6 text-pula-muted">{current.body}</Text>

        <OnboardingArt kind={current.kind} />
        <StepDetail kind={current.kind} />

        <View className="mt-auto pt-5">
          {finishing ? (
            <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg }}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : (
            <GradientButton label={current.action} onPress={next} showArrow={current.kind !== "id"} />
          )}

          {current.kind === "email" ? (
            <Pressable className="mt-5 items-center" onPress={next}>
              <Text className="text-sm font-extrabold text-pula-blue">Resend email (00:45)</Text>
            </Pressable>
          ) : null}

          <View className="mt-8 flex-row justify-center gap-5">{dots}</View>
        </View>
      </View>
    </Screen>
  );
}

function OnboardingHeader({ step, setStep }: { step: number; setStep: (value: number) => void }) {
  return (
    <View className="flex-row items-center justify-between">
      {step === 0 ? (
        <Text className="text-3xl font-extrabold text-pula-blue">PulaCash</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          className="h-12 w-12 items-center justify-center rounded-full bg-white"
          style={shadows.soft}
          onPress={() => setStep(Math.max(step - 1, 0))}
        >
          <ArrowLeft color={colors.blue} size={22} strokeWidth={2.6} />
        </Pressable>
      )}
      <View className="rounded-full bg-pula-mist px-5 py-2">
        <Text className="text-sm font-extrabold text-pula-blue">
          {step + 1} of {steps.length}
        </Text>
      </View>
      <View className="h-12 w-12" />
    </View>
  );
}

function OnboardingArt({ kind }: { kind: StepKind }) {
  if (kind === "email") return <EmailArt />;
  if (kind === "id") return <IdArt />;
  if (kind === "how") return <HowArt />;
  if (kind === "done") return <DoneArt />;
  return <StartArt />;
}

function ArtShell({ children }: { children: ReactNode }) {
  return (
    <View className="my-8 h-64 items-center justify-center overflow-hidden rounded-[36px] bg-white" style={shadows.soft}>
      <View className="absolute h-52 w-52 rounded-full bg-pula-mist" />
      {children}
    </View>
  );
}

function StartArt() {
  return (
    <ArtShell>
      <View className="h-24 w-24 items-center justify-center rounded-[34px] bg-white" style={shadows.soft}>
        <UserRound color={colors.blue} size={48} strokeWidth={1.8} />
      </View>
      <View className="mt-4 flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
          <Mail color={colors.blue} size={24} />
        </View>
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">
          <ShieldCheck color={colors.blue} size={24} />
        </View>
      </View>
    </ArtShell>
  );
}

function EmailArt() {
  return (
    <ArtShell>
      <Svg width={230} height={170} viewBox="0 0 230 170">
        <Path d="M24 126c44-34 86-34 128 0" stroke="#BCD3F8" strokeWidth="3" strokeDasharray="8 10" fill="none" />
        <Path d="M154 48l48-22-18 50-12-20-24-8z" fill="#2376FF" />
        <Rect x="35" y="72" width="116" height="72" rx="14" fill="#F9FCFF" stroke="#8DB7F8" strokeWidth="2" />
        <Path d="M42 82l51 37 51-37" stroke="#8DB7F8" strokeWidth="2.5" fill="none" />
        <Circle cx="93" cy="108" r="22" fill="#075DFF" />
        <Path d="M83 108l7 7 16-18" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </ArtShell>
  );
}

function IdArt() {
  return (
    <ArtShell>
      <View className="rounded-[24px] border-2 border-pula-blue p-4">
        <View className="w-56 overflow-hidden rounded-2xl bg-white" style={shadows.soft}>
          <LinearGradient colors={gradients.button} className="h-10 justify-center px-4">
            <Text className="text-sm font-extrabold text-white">STUDENT ID</Text>
          </LinearGradient>
          <View className="flex-row gap-4 p-4">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-pula-mist">
              <UserRound color={colors.blue} size={30} />
            </View>
            <View className="flex-1 justify-center gap-2">
              <View className="h-2.5 w-20 rounded-full bg-pula-line" />
              <View className="h-2.5 w-28 rounded-full bg-pula-line" />
              <View className="h-2.5 w-24 rounded-full bg-pula-line" />
            </View>
          </View>
          <View className="mx-4 mb-4 h-7 flex-row items-end gap-1">
            {Array.from({ length: 15 }).map((_, index) => (
              <View key={index} className="w-1.5 bg-pula-ink" style={{ height: index % 2 === 0 ? 24 : 16 }} />
            ))}
          </View>
        </View>
      </View>
    </ArtShell>
  );
}

function HowArt() {
  return (
    <ArtShell>
      <Svg width={230} height={174} viewBox="0 0 230 174">
        <Rect x="28" y="116" width="116" height="20" rx="10" fill="#DCEAFF" />
        <Rect x="42" y="68" width="92" height="62" rx="12" fill="#FFFFFF" stroke="#8DB7F8" strokeWidth="2" />
        <Rect x="58" y="84" width="56" height="30" rx="5" fill="#EAF2FF" />
        <Line x1="162" y1="28" x2="162" y2="144" stroke="#075DFF" strokeWidth="4" strokeLinecap="round" />
        {[36, 86, 136].map((cy, index) => (
          <Circle key={cy} cx="162" cy={cy} r="15" fill="#075DFF" />
        ))}
        <Path d="M154 36l6 6 11-14" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M154 86l6 6 11-14" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M154 136l6 6 11-14" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </ArtShell>
  );
}

function DoneArt() {
  return (
    <ArtShell>
      <View className="h-28 w-28 items-center justify-center rounded-full bg-white" style={shadows.soft}>
        <LinearGradient colors={gradients.button} className="h-24 w-24 items-center justify-center rounded-full">
          <Check color={colors.white} size={56} strokeWidth={3} />
        </LinearGradient>
      </View>
      <View className="absolute left-14 top-14 h-3 w-3 rounded-full bg-pula-blue" />
      <View className="absolute right-16 top-20 h-3 w-3 rounded-full bg-pula-cyan" />
      <View className="absolute bottom-16 left-20 h-3 w-3 rounded-full bg-pula-cyan" />
    </ArtShell>
  );
}

function StepDetail({ kind }: { kind: StepKind }) {
  if (kind === "email") {
    return (
      <GlassCard className="mb-1">
        <Text className="text-base font-extrabold text-pula-ink">{demoUser.email}</Text>
        <Text className="mt-2 text-sm leading-5 text-pula-muted">Check your inbox and click the link to verify.</Text>
      </GlassCard>
    );
  }

  if (kind === "id") {
    return (
      <GlassCard className="mb-1" contentClassName="gap-4">
        <SecurityRow icon={<ShieldCheck color={colors.blue} size={24} />} title="Secure verification" body="Your data is protected" />
        <SecurityRow icon={<LockKeyhole color={colors.blue} size={24} />} title="For students only" body="Enrolled at recognized institutions" />
      </GlassCard>
    );
  }

  if (kind === "how") {
    return (
      <GlassCard className="mb-1" contentClassName="gap-4">
        {["Apply for a loan", "Get funds fast", "Repay on time", "Build your reliability score"].map((item) => (
          <View key={item} className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-pula-blue">
              <CheckCircle2 color={colors.white} size={20} />
            </View>
            <Text className="flex-1 text-base font-extrabold text-pula-ink">{item}</Text>
          </View>
        ))}
      </GlassCard>
    );
  }

  if (kind === "done") {
    return (
      <GlassCard className="mb-1">
        <View className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-pula-mist">
            <Gift color={colors.blue} size={28} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-pula-ink">Small loans. Big impact.</Text>
            <Text className="mt-1 text-sm leading-5 text-pula-muted">Build your reliability and unlock larger amounts over time.</Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  return (
    <View className="mb-1 flex-row items-center justify-center gap-2">
      <ShieldCheck color={colors.blue} size={20} />
      <Text className="text-sm font-semibold text-pula-muted">Student only. Secure and verified.</Text>
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
