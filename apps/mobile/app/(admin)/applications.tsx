import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { LoanApplication } from "@pulacash/shared";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoApplications } from "@/lib/demo-data";
import { colors, radius } from "@/theme/tokens";

export default function ApplicationsScreen() {
  const { data } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => apiFetch<LoanApplication[]>(endpoints.admin.loanApplications, { role: "admin" }).catch(() => demoApplications),
    initialData: demoApplications
  });

  return (
    <Screen tabBar={false}>
      <TopBar back title="Applications" />
      {data.map((application) => (
        <Pressable
          key={application.id}
          className="mb-4 bg-white p-5"
          style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}
          onPress={() =>
            router.push({
              pathname: "/loan-review",
              params: {
                id: application.id,
                amount: String(application.amount),
                purpose: application.purpose,
                due: application.expectedRepaymentDate
              }
            })
          }
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-pula-ink">P{application.amount}.00</Text>
              <Text className="mt-1 text-sm font-semibold text-pula-muted">{application.purpose}</Text>
              <Text className="mt-3 text-sm text-pula-muted">Due {application.expectedRepaymentDate}</Text>
            </View>
            <StatusPill label={application.status.replaceAll("_", " ")} tone="amber" />
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
