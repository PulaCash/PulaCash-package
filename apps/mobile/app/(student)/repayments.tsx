import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Banknote, CalendarDays, Landmark, ShieldCheck } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";
import { Dashboard, defaultLoanLimits, Loan } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { apiFetch, demoAuthBypassEnabled } from "@/lib/api";
import { createDemoRepayment, demoDashboard, demoLoans } from "@/lib/demo-data";
import { endpoints } from "@/lib/endpoints";
import { colors, control, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

export default function RepaymentsScreen() {
  const queryClient = useQueryClient();
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiFetch<Loan[]>(endpoints.loans.mine).catch(() => demoLoans),
    initialData: demoLoans
  });

  const loan = loans.data?.find((item) => item.status !== "repaid" && item.status !== "rejected");

  const repay = useMutation({
    mutationFn: () => {
      if (!loan) throw new Error("No active loan to repay.");
      if (demoAuthBypassEnabled) return Promise.resolve(createDemoRepayment(loan));
      return apiFetch(endpoints.repayments.initiate, {
        method: "POST",
        body: JSON.stringify({ loanId: loan.id, amount: loan.repaymentAmount, method: "manual_bank_transfer" })
      });
    },
    onSuccess: async () => {
      if (demoAuthBypassEnabled && loan) {
        queryClient.setQueryData<Loan[]>(["loans"], (current) =>
          (current ?? demoLoans).map((item) => (item.id === loan.id ? { ...item, status: "repaid" } : item))
        );
        queryClient.setQueryData<Dashboard>(["dashboard"], (current) => ({
          ...(current ?? demoDashboard),
          borrowing: {
            ...(current ?? demoDashboard).borrowing,
            available: defaultLoanLimits.availableToBorrow,
            activeLoanAmount: null,
            lastDisbursedAmount: loan.amount,
            nextDueDate: null
          }
        }));
      } else {
        await queryClient.invalidateQueries();
      }
      router.replace("/home");
    }
  });

  if (!loan) {
    return (
      <Screen>
        <TopBar title="Repayments" bell />
        <GlassCard>
          <Text className="text-2xl font-extrabold text-pula-ink">No active loan</Text>
          <Text className="mt-2 text-base text-pula-muted">You have nothing to repay right now.</Text>
          <GradientButton label="Request a loan" onPress={() => router.push("/apply")} style={{ marginTop: SECTION_GAP }} />
        </GlassCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Repayments" bell />
      <GlassCard fill={colors.blue}>
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/20">
            <Banknote color={colors.white} size={iconSize.lg} />
          </View>
          <View>
            <Text className="text-base text-white/80">Active loan due</Text>
            <Text className="text-5xl font-extrabold text-white">P{loan.repaymentAmount}.00</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mt-6">
        <View className="flex-row items-center gap-3">
          <CalendarDays color={colors.blue} size={iconSize.md} />
          <View>
            <Text className="text-sm font-bold uppercase text-pula-muted">Due date</Text>
            <Text className="mt-1 text-xl font-extrabold text-pula-ink">{loan.dueDate}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mt-5" contentClassName="gap-4">
        <View className="flex-row items-center gap-3">
          <Landmark color={colors.blue} size={iconSize.md} />
          <View className="flex-1">
            <Text className="text-base font-extrabold text-pula-ink">Manual bank transfer</Text>
            <Text className="mt-1 text-sm text-pula-muted">Tap repay to record your payment for this loan.</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <ShieldCheck color={colors.success} size={iconSize.md} />
          <Text className="flex-1 text-sm font-semibold text-pula-muted">Payment secrets remain server-side only.</Text>
        </View>
      </GlassCard>

      {repay.isError ? (
        <Text className="mt-4 text-sm font-semibold text-red-500">{(repay.error as Error).message}</Text>
      ) : null}

      {repay.isPending ? (
        <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg, marginTop: SECTION_GAP }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <GradientButton label="Repay now" onPress={() => repay.mutate()} style={{ marginTop: SECTION_GAP }} />
      )}
    </Screen>
  );
}
