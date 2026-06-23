import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { Loan } from "@pulacash/shared";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoLoans } from "@/lib/demo-data";
import { colors, radius } from "@/theme/tokens";

export default function HistoryScreen() {
  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: () => apiFetch<Loan[]>(endpoints.loans.mine).catch(() => demoLoans),
    initialData: demoLoans
  });

  const list = [...(loans.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Screen>
      <TopBar back title="Loan history" />
      {list.length === 0 ? (
        <View className="mt-4 bg-white p-5" style={{ borderRadius: radius.lg, borderColor: colors.line, borderWidth: 1 }}>
          <Text className="text-base font-semibold text-pula-muted">No loans yet. Your activity will show here.</Text>
        </View>
      ) : null}
      {list.map((loan) => (
        <View key={loan.id} className="mb-4 bg-white p-5" style={{ borderRadius: radius.lg, borderColor: colors.line, borderWidth: 1 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-extrabold text-pula-ink">P{loan.amount}.00</Text>
              <Text className="mt-1 text-sm text-pula-muted">{loan.createdAt.slice(0, 10)}</Text>
            </View>
            <StatusPill label={loan.status === "repaid" ? "Repaid" : "Active"} tone={loan.status === "repaid" ? "green" : "blue"} />
          </View>
          <Text className="mt-4 text-sm font-semibold text-pula-muted">
            Repayment P{loan.repaymentAmount}.00 · Due {loan.dueDate}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
