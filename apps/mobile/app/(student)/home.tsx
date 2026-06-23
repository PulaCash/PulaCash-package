import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowRight, Banknote, Bell, CalendarDays, ChevronRight, HandCoins, History, Info, TrendingUp } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Dashboard } from "@pulacash/shared";
import { ReliabilityRing } from "@/components/ReliabilityRing";
import { Screen } from "@/components/Screen";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoDashboard } from "@/lib/demo-data";
import { colors, gradients, iconSize, radius, shadows } from "@/theme/tokens";

export default function HomeScreen() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<Dashboard>(endpoints.student.dashboard).catch(() => demoDashboard),
    initialData: demoDashboard
  });

  const firstName = data.student.name.split(" ")[0] ?? "Student";
  const upcomingAmount = data.borrowing.activeLoanAmount ?? 0;

  return (
    <Screen>
      <View className="mb-5 mt-2 flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-pula-mist">
            <Text className="text-xl font-extrabold text-pula-blue">{data.student.initials}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-2xl font-extrabold text-pula-ink" numberOfLines={1}>Hi, {firstName}</Text>
            <Text className="mt-1 text-xs font-semibold text-pula-muted" numberOfLines={1}>Welcome back to PulaCash</Text>
          </View>
        </View>
        <Pressable className="ml-3 h-14 w-14 items-center justify-center rounded-full bg-white" style={shadows.soft}>
          <Bell color="#5E6676" size={26} strokeWidth={1.9} />
          <View className="absolute right-3 top-2.5 h-3 w-3 rounded-full border-2 border-white bg-pula-blue" />
        </Pressable>
      </View>

      <BorrowingCard
        available={data.borrowing.available}
        limit={data.borrowing.limit}
        score={data.reliability.score}
        scoreLabel={data.reliability.label}
      />

      <View className="mt-6 flex-row gap-4">
        <QuickAction
          label="Apply"
          sublabel="Request a loan"
          icon={<Banknote color={colors.blue} size={26} strokeWidth={2.2} />}
          onPress={() => router.push("/apply")}
        />
        <QuickAction
          label="Repay"
          sublabel="Make a payment"
          icon={<HandCoins color={colors.blue} size={26} strokeWidth={2.2} />}
          onPress={() => router.push("/repayments")}
        />
        <QuickAction
          label="History"
          sublabel="Loan activity"
          icon={<History color={colors.blue} size={26} strokeWidth={2.2} />}
          onPress={() => router.push("/history")}
        />
      </View>

      <View className="mt-6 flex-row items-center border border-pula-line bg-white p-4" style={[{ borderRadius: radius.lg }, shadows.card]}>
        <View className="h-14 w-14 items-center justify-center rounded-full bg-pula-mist">
          <CalendarDays color={colors.blue} size={iconSize.lg} strokeWidth={2.1} />
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-base font-semibold text-pula-muted">Upcoming repayment</Text>
          <Text className="mt-1 text-3xl font-extrabold text-pula-ink">{formatMoney(upcomingAmount)}</Text>
          <Text className="text-base font-medium text-pula-muted">Due {formatDueDate(data.borrowing.nextDueDate)}</Text>
        </View>
        <Pressable className="h-12 items-center justify-center rounded-full bg-pula-mist px-7" onPress={() => router.push("/repayments")}>
          <Text className="text-lg font-extrabold text-pula-blue">View</Text>
        </Pressable>
      </View>

      <Pressable
        className="mt-5 flex-row items-center border p-3"
        style={{ borderRadius: radius.md, borderColor: "rgba(18,185,129,0.28)", backgroundColor: "#F7FFFC" }}
        onPress={() => router.push("/repayments")}
      >
        <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: colors.successSoft }}>
          <TrendingUp color={colors.success} size={iconSize.md} strokeWidth={2.6} />
        </View>
        <View className="ml-4 flex-1">
          <Text className="text-base font-extrabold text-pula-ink">Stay on track</Text>
          <Text className="mt-1 text-sm font-medium text-pula-muted" numberOfLines={1}>Repay on time for higher limits.</Text>
        </View>
        <ChevronRight color="#6B7280" size={iconSize.md} strokeWidth={2.2} />
      </Pressable>
    </Screen>
  );
}

function BorrowingCard({
  available,
  limit,
  score,
  scoreLabel
}: {
  available: number;
  limit: number;
  score: number;
  scoreLabel: string;
}) {
  return (
    <LinearGradient
      colors={gradients.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      // Padding/border MUST be inline: NativeWind silently drops these classes on
      // expo-linear-gradient, which is what clipped the "Available to borrow" label.
      style={[{ borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: colors.line }, shadows.card]}
    >
      {/* Full-width label row so nothing gets clipped by the score ring. */}
      <View className="flex-row items-center">
        <Text className="text-base font-semibold text-pula-muted">Available to borrow</Text>
        <Info color="#6E7688" size={17} style={{ marginLeft: 6 }} />
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="mr-3 flex-1">
          <Text
            className="text-5xl font-extrabold text-pula-blue"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatMoney(available)}
          </Text>
          <Text className="mt-1 text-lg font-medium text-pula-muted" numberOfLines={1}>
            of {formatMoney(limit)} limit
          </Text>
        </View>
        <ReliabilityRing score={score} label={scoreLabel} size={104} />
      </View>

      {/* Full-width pill — can't be clipped by the column. */}
      <Pressable
        className="mt-5 h-14 w-full flex-row items-center justify-center rounded-full bg-pula-blue"
        style={shadows.button}
        onPress={() => router.push("/apply")}
      >
        <Text className="text-lg font-extrabold text-white">Request loan</Text>
        <View className="ml-3 h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowRight color={colors.blue} size={iconSize.md} strokeWidth={2.8} />
        </View>
      </Pressable>
    </LinearGradient>
  );
}

function QuickAction({
  label,
  sublabel,
  icon,
  onPress
}: {
  label: string;
  sublabel: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="min-h-[120px] flex-1 items-center justify-center border border-pula-line bg-white p-3"
      style={[{ borderRadius: radius.lg }, shadows.soft]}
      onPress={onPress}
    >
      <View className="mb-3 h-14 w-14 items-center justify-center rounded-full bg-pula-mist">{icon}</View>
      <Text className="text-center text-lg font-extrabold text-pula-ink">{label}</Text>
      <Text className="mt-1 text-center text-sm font-medium leading-5 text-pula-muted">{sublabel}</Text>
    </Pressable>
  );
}

function formatMoney(value: number) {
  return `P${value.toFixed(2)}`;
}

function formatDueDate(date: string | null) {
  if (!date) return "after approval";
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
