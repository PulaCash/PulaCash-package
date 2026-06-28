import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { AlertTriangle, Banknote, Clock3, ShieldCheck, UsersRound } from "lucide-react-native";
import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AdminDashboard } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoAdminDashboard } from "@/lib/demo-data";
import { colors, control, iconSize, radius } from "@/theme/tokens";

export default function AdminDashboardScreen() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiFetch<AdminDashboard>(endpoints.admin.dashboard).catch(() => demoAdminDashboard),
    initialData: demoAdminDashboard
  });

  return (
    <Screen tabBar={false}>
      <TopBar back title="Admin" />
      <Text className="text-4xl font-extrabold text-pula-ink">Portfolio health</Text>
      <Text className="mt-3 text-base text-pula-muted">Review loans, repayments, and student verification from one protected area.</Text>

      <View className="mt-7 flex-row flex-wrap gap-3">
        <Metric label="Pending" value={data.pendingApplications} icon={<Clock3 color={colors.blue} size={iconSize.md} />} />
        <Metric label="ID checks" value={data.pendingIdVerifications} icon={<ShieldCheck color={colors.warning} size={iconSize.md} />} />
        <Metric label="Active loans" value={data.activeLoans} icon={<Banknote color={colors.blue} size={iconSize.md} />} />
        <Metric label="Due" value={data.repaymentsDue} icon={<AlertTriangle color={colors.warning} size={iconSize.md} />} />
        <Metric label="Verified" value={data.verifiedStudents} icon={<ShieldCheck color={colors.success} size={iconSize.md} />} />
      </View>

      <GlassCard className="mt-6" contentClassName="gap-3">
        <AdminLink label="Pending loan applications" onPress={() => router.push("/applications")} />
        <AdminLink label="Student management" onPress={() => router.push("/students")} />
      </GlassCard>
    </Screen>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <View className="w-[48%] bg-white p-5" style={{ borderRadius: radius.lg }}>
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">{icon}</View>
      <Text className="mt-5 text-4xl font-extrabold text-pula-ink">{value}</Text>
      <Text className="mt-1 text-sm font-semibold text-pula-muted">{label}</Text>
    </View>
  );
}

function AdminLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable className="flex-row items-center justify-between bg-pula-mist px-5" style={{ height: control.height, borderRadius: radius.md }} onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <UsersRound color={colors.blue} size={iconSize.md} />
        <Text className="text-base font-extrabold text-pula-ink">{label}</Text>
      </View>
      <Text className="text-xl font-extrabold text-pula-blue">›</Text>
    </Pressable>
  );
}
