import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Ban, CheckCircle2, History, ShieldAlert } from "lucide-react-native";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { LoanApplication } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch, demoAuthBypassEnabled } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { demoApplications } from "@/lib/demo-data";
import { colors, iconSize } from "@/theme/tokens";

export default function LoanReviewScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string; amount?: string; purpose?: string; due?: string }>();
  const application = {
    id: params.id ?? demoApplications[0].id,
    amount: params.amount ? Number(params.amount) : demoApplications[0].amount,
    purpose: params.purpose ?? demoApplications[0].purpose,
    expectedRepaymentDate: params.due ?? demoApplications[0].expectedRepaymentDate
  };

  async function refreshAndBack() {
    if (!demoAuthBypassEnabled) {
      await queryClient.invalidateQueries();
    }
    router.back();
  }

  function updateDemoApplication(status: LoanApplication["status"], decisionReason?: string) {
    queryClient.setQueryData<LoanApplication[]>(["admin-applications"], (current) =>
      (current ?? demoApplications).map((item) =>
        item.id === application.id ? { ...item, status, decisionReason } : item
      )
    );
  }

  async function approve() {
    if (demoAuthBypassEnabled) {
      updateDemoApplication("approved");
      await refreshAndBack();
      return;
    }
    await apiFetch(endpoints.admin.approve(application.id), { method: "POST", role: "admin" }).catch(() => undefined);
    await refreshAndBack();
  }

  async function reject() {
    const reason = "Needs stronger repayment history.";
    if (demoAuthBypassEnabled) {
      updateDemoApplication("rejected", reason);
      await refreshAndBack();
      return;
    }
    await apiFetch(endpoints.admin.reject(application.id), {
      method: "POST",
      role: "admin",
      body: JSON.stringify({ reason })
    }).catch(() => undefined);
    await refreshAndBack();
  }

  return (
    <Screen tabBar={false}>
      <TopBar back title="Review loan" />
      <GlassCard fill={colors.blue}>
        <StatusPill label="Pending review" tone="amber" />
        <Text className="mt-5 text-5xl font-extrabold text-white">P{application.amount}.00</Text>
        <Text className="mt-2 text-base text-white/85">{application.purpose} · Due {application.expectedRepaymentDate}</Text>
      </GlassCard>

      <GlassCard className="mt-6" contentClassName="gap-4">
        <ReviewRow icon={<BadgeCheck color={colors.success} size={iconSize.md} />} label="Student verification" value="Email and ID verified" />
        <ReviewRow icon={<History color={colors.blue} size={iconSize.md} />} label="Previous loan history" value="2 loans, 2 repaid on time" />
        <ReviewRow icon={<ShieldAlert color={colors.warning} size={iconSize.md} />} label="Reliability score" value="72 Good" />
      </GlassCard>

      <View className="mt-6 flex-row gap-3">
        <View className="flex-1">
          <GradientButton label="Approve" onPress={approve} showArrow={false} icon={<CheckCircle2 color={colors.white} size={iconSize.sm} />} />
        </View>
        <View className="flex-1">
          <GradientButton label="Reject" onPress={reject} variant="ghost" icon={<Ban color={colors.danger} size={iconSize.sm} />} />
        </View>
      </View>

      <GradientButton label="Blacklist student" variant="ghost" onPress={() => router.push("/student-detail")} style={{ marginTop: 12 }} />
    </Screen>
  );
}

function ReviewRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-pula-mist">{icon}</View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-pula-muted">{label}</Text>
        <Text className="mt-1 text-base font-extrabold text-pula-ink">{value}</Text>
      </View>
    </View>
  );
}
