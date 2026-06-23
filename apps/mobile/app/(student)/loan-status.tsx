import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Check, Circle, Clock3 } from "lucide-react-native";
import { Text, View } from "react-native";
import { Loan } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoLoans } from "@/lib/demo-data";
import { colors } from "@/theme/tokens";

const order = ["pending_review", "approved", "disbursed", "repayment_due", "repaid"];
const lifecycleLabels = [
  { key: "approved", label: "Approved" },
  { key: "disbursed", label: "Funds sent" },
  { key: "repayment_due", label: "Repayment due" },
  { key: "repaid", label: "Repaid" }
];

export default function LoanStatusScreen() {
  const params = useLocalSearchParams<{ id?: string; applicationId?: string }>();
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiFetch<Loan[]>(endpoints.loans.mine).catch(() => demoLoans)
  });

  const list = loans.data ?? demoLoans;
  const loan =
    list.find((item) => item.id === params.id) ??
    list.find((item) => item.applicationId === params.applicationId) ??
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const pending = !loan || (params.applicationId && !params.id && loan.applicationId !== params.applicationId);
  const currentIndex = loan ? order.indexOf(loan.status) : 0;
  const isDisbursed = loan && ["disbursed", "repayment_due", "repaid"].includes(loan.status);

  return (
    <Screen>
      <TopBar back title="Loan status" />

      {pending ? (
        <GlassCard>
          <StatusPill label="PENDING REVIEW" tone="amber" />
          <Text className="mt-5 text-2xl font-extrabold text-pula-ink">Submitted for review</Text>
          <Text className="mt-2 text-base text-pula-muted">
            Your request is being reviewed. You’ll be notified once it’s approved and disbursed.
          </Text>
        </GlassCard>
      ) : (
        <GlassCard fill={colors.blue}>
          <StatusPill label={isDisbursed ? "FUNDS SENT" : loan!.status.replaceAll("_", " ").toUpperCase()} tone="green" />
          <Text className="mt-5 text-5xl font-extrabold text-white">P{loan!.amount}.00</Text>
          <Text className="mt-2 text-base text-white/90">
            {isDisbursed ? "Sent to your account · " : ""}Repay P{loan!.repaymentAmount}.00 by {loan!.dueDate}
          </Text>
        </GlassCard>
      )}

      <Text className="mb-4 mt-8 text-xl font-extrabold text-pula-ink">Lifecycle</Text>
      <GlassCard>
        {lifecycleLabels.map((item, index) => {
          const done = !pending && currentIndex >= order.indexOf(item.key);
          const isNext = !done && index === 0;
          return (
            <View key={item.key} className="flex-row gap-4">
              <View className="items-center">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: done ? colors.blue : colors.mist }}
                >
                  {done ? (
                    <Check color={colors.white} size={20} />
                  ) : isNext ? (
                    <Clock3 color={colors.blue} size={20} />
                  ) : (
                    <Circle color={colors.blue} size={18} />
                  )}
                </View>
                {index < lifecycleLabels.length - 1 ? <View className="h-12 w-0.5 bg-pula-line" /> : null}
              </View>
              <View className="pt-2">
                <Text className="text-base font-extrabold text-pula-ink">{item.label}</Text>
                <Text className="mt-1 text-sm text-pula-muted">{done ? "Completed" : isNext ? "Next step" : "Waiting"}</Text>
              </View>
            </View>
          );
        })}
      </GlassCard>
    </Screen>
  );
}
