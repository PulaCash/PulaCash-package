import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Banknote, CalendarDays, Check, Layers, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Dashboard, Loan, PaymentMethod, paymentMethodLabels, paymentMethods, Repayment, RepaymentResult } from "@pulacash/shared";
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
  const [method, setMethod] = useState<PaymentMethod>("orange_money");
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiFetch<Loan[]>(endpoints.loans.mine).catch(() => demoLoans),
    initialData: demoLoans
  });
  const repayments = useQuery({
    queryKey: ["repayments"],
    queryFn: () => apiFetch<Repayment[]>(endpoints.repayments.mine).catch(() => [] as Repayment[]),
    initialData: [] as Repayment[]
  });

  const loan = loans.data?.find((item) => item.status !== "repaid" && item.status !== "rejected");

  // For an installment loan, charge the next unpaid installment; for a bullet loan
  // there's a single repayment of the full amount.
  const unpaid = (repayments.data ?? [])
    .filter((r) => loan && r.loanId === loan.id && r.status !== "paid")
    .sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1));
  const nextDue = unpaid[0];
  const isInstallment = (loan?.installmentCount ?? 1) > 1;
  const dueNow = nextDue?.amount ?? loan?.repaymentAmount ?? 0;
  const remaining = unpaid.length > 0 ? unpaid.reduce((sum, r) => sum + r.amount, 0) : loan?.repaymentAmount ?? 0;

  const repay = useMutation({
    mutationFn: () => {
      if (!loan) throw new Error("No active loan to repay.");
      if (demoAuthBypassEnabled) return Promise.resolve(createDemoRepayment(loan));
      // The amount is computed and charged server-side — we only choose the rail.
      return apiFetch<RepaymentResult>(endpoints.repayments.initiate, { method: "POST", body: JSON.stringify({ loanId: loan.id, method }) });
    },
    onSuccess: async (result) => {
      if (demoAuthBypassEnabled && loan) {
        queryClient.setQueryData<Loan[]>(["loans"], (current) =>
          (current ?? demoLoans).map((item) => (item.id === loan.id ? { ...item, status: "repaid" } : item))
        );
        queryClient.setQueryData<Dashboard>(["dashboard"], (current) => ({
          ...(current ?? demoDashboard),
          borrowing: { ...(current ?? demoDashboard).borrowing, available: (current ?? demoDashboard).membership.limit, activeLoanAmount: null, lastDisbursedAmount: loan.amount, nextDueDate: null }
        }));
      } else {
        await queryClient.invalidateQueries();
      }
      // Installment loans stay open until the final payment settles.
      if (result.loanStatus === "repaid") router.replace("/home");
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
            <Text className="text-base text-white/80">{isInstallment ? "Next installment due" : "Active loan due"}</Text>
            <Text className="text-5xl font-extrabold text-white">P{dueNow}.00</Text>
            {isInstallment ? (
              <Text className="mt-1 text-sm text-white/80">P{remaining}.00 remaining over {unpaid.length} payment{unpaid.length === 1 ? "" : "s"}</Text>
            ) : null}
          </View>
        </View>
      </GlassCard>

      {isInstallment ? (
        <GlassCard className="mt-6" contentClassName="gap-2">
          <View className="flex-row items-center gap-3">
            <Layers color={colors.blue} size={iconSize.md} />
            <Text className="text-sm font-bold uppercase text-pula-muted">Monthly plan</Text>
          </View>
          {[...(repayments.data ?? [])]
            .filter((r) => r.loanId === loan.id)
            .sort((a, b) => (a.installmentNumber ?? 1) - (b.installmentNumber ?? 1))
            .map((r) => (
              <View key={r.id} className="flex-row items-center justify-between py-1.5">
                <Text className="text-base text-pula-muted">
                  Payment {r.installmentNumber}/{r.installmentsTotal} · {r.dueDate}
                </Text>
                <Text className={`text-base font-bold ${r.status === "paid" ? "text-pula-muted line-through" : "text-pula-ink"}`}>P{r.amount}.00</Text>
              </View>
            ))}
        </GlassCard>
      ) : (
        <GlassCard className="mt-6">
          <View className="flex-row items-center gap-3">
            <CalendarDays color={colors.blue} size={iconSize.md} />
            <View>
              <Text className="text-sm font-bold uppercase text-pula-muted">Due date</Text>
              <Text className="mt-1 text-xl font-extrabold text-pula-ink">{loan.dueDate}</Text>
            </View>
          </View>
        </GlassCard>
      )}

      <GlassCard className="mt-5" contentClassName="gap-3">
        <Text className="text-sm font-bold uppercase text-pula-muted">Pay from</Text>
        {paymentMethods.map((option) => {
          const selected = option === method;
          return (
            <Pressable
              key={option}
              className="flex-row items-center justify-between px-4 py-3"
              style={{ borderRadius: radius.md, backgroundColor: selected ? colors.blueSoft : colors.mist, borderWidth: 1, borderColor: selected ? colors.blue : "transparent" }}
              onPress={() => setMethod(option)}
            >
              <Text className="font-semibold" style={{ color: selected ? colors.blue : colors.ink }}>{paymentMethodLabels[option]}</Text>
              {selected ? <Check color={colors.blue} size={iconSize.sm} /> : null}
            </Pressable>
          );
        })}
        <View className="flex-row items-center gap-3 pt-1">
          <ShieldCheck color={colors.success} size={iconSize.md} />
          <Text className="flex-1 text-sm font-semibold text-pula-muted">The exact amount owed is charged securely — never set on your device.</Text>
        </View>
      </GlassCard>

      {repay.isError ? <Text className="mt-4 text-sm font-semibold text-red-500">{(repay.error as Error).message}</Text> : null}

      {repay.isPending ? (
        <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg, marginTop: SECTION_GAP }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <GradientButton label={`Pay P${dueNow}.00`} onPress={() => repay.mutate()} style={{ marginTop: SECTION_GAP }} />
      )}
    </Screen>
  );
}
