import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CheckCircle2, Clock3, FileText } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Loan } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoLoans } from "@/lib/demo-data";
import { colors, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

export default function LoansScreen() {
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiFetch<Loan[]>(endpoints.loans.mine).catch(() => demoLoans),
    initialData: demoLoans
  });

  const list = loans.data ?? [];
  const active = list.find((loan) => loan.status !== "repaid" && loan.status !== "rejected");

  return (
    <Screen>
      <TopBar title="Loans" bell />
      {active ? (
        <GlassCard>
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <StatusPill label={active.status.replaceAll("_", " ").toUpperCase()} tone="blue" />
              <Text className="mt-4 text-4xl font-extrabold text-pula-ink">P{active.amount}.00</Text>
              <Text className="mt-2 text-base text-pula-muted">Repay P{active.repaymentAmount}.00 by {active.dueDate}</Text>
            </View>
            <View className="h-16 w-16 items-center justify-center rounded-3xl bg-pula-mist">
              <FileText color={colors.blue} size={iconSize.lg} />
            </View>
          </View>
          <GradientButton
            label="View loan status"
            onPress={() => router.push({ pathname: "/loan-status", params: { id: active.id } })}
            style={{ marginTop: SECTION_GAP }}
          />
        </GlassCard>
      ) : (
        <GlassCard>
          <Text className="text-2xl font-extrabold text-pula-ink">No active loan</Text>
          <Text className="mt-2 text-base text-pula-muted">Request an emergency microloan in seconds.</Text>
          <GradientButton label="Request a loan" onPress={() => router.push("/apply")} style={{ marginTop: SECTION_GAP }} />
        </GlassCard>
      )}

      <View className="mt-6 flex-row gap-3">
        <Pressable className="flex-1 bg-white p-5" style={{ borderRadius: radius.lg, borderColor: colors.line, borderWidth: 1 }} onPress={() => router.push("/apply")}>
          <Clock3 color={colors.blue} size={iconSize.md} />
          <Text className="mt-4 text-lg font-extrabold text-pula-ink">Apply</Text>
          <Text className="mt-1 text-sm text-pula-muted">Request a new loan</Text>
        </Pressable>
        <Pressable className="flex-1 bg-white p-5" style={{ borderRadius: radius.lg, borderColor: colors.line, borderWidth: 1 }} onPress={() => router.push("/history")}>
          <CheckCircle2 color={colors.success} size={iconSize.md} />
          <Text className="mt-4 text-lg font-extrabold text-pula-ink">History</Text>
          <Text className="mt-1 text-sm text-pula-muted">Past activity</Text>
        </Pressable>
      </View>

      <Text className="mb-3 mt-8 text-xl font-extrabold text-pula-ink">Recent loans</Text>
      {list.map((loan) => (
        <Pressable
          key={loan.id}
          className="mb-3 bg-white p-5"
          style={{ borderRadius: radius.md, borderColor: colors.line, borderWidth: 1 }}
          onPress={() => router.push({ pathname: "/loan-status", params: { id: loan.id } })}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-extrabold text-pula-ink">P{loan.amount}.00</Text>
              <Text className="mt-1 text-sm text-pula-muted">{loan.createdAt.slice(0, 10)}</Text>
            </View>
            <StatusPill label={loan.status.replaceAll("_", " ")} tone={loan.status === "repaid" ? "green" : "blue"} />
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
