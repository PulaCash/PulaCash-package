import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Ban, BadgeCheck, CheckCircle2, History, ShieldCheck, UserRound, XCircle } from "lucide-react-native";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { scoreBandFor } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { ReliabilityRing } from "@/components/ReliabilityRing";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { colors, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

type StudentDetail = {
  id: string;
  fullName: string;
  email: string;
  isBlacklisted: boolean;
  emailVerified?: boolean;
  profile?: { idStatus?: string; studentNumber?: string; phoneNumber?: string } | null;
  reliability?: { score?: number } | null;
  loans?: { status: string }[];
};

export default function StudentDetailScreen() {
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const { data } = useQuery({
    queryKey: ["admin-student", id],
    enabled: Boolean(id),
    queryFn: () => apiFetch<StudentDetail>(endpoints.admin.studentById(id!))
  });

  const verify = useMutation({
    mutationFn: (approved: boolean) =>
      apiFetch(endpoints.admin.verifyId(id!), { method: "POST", body: JSON.stringify({ approved }) }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const blacklist = useMutation({
    mutationFn: (blacklisted: boolean) =>
      apiFetch(endpoints.admin.blacklist(id!), {
        method: "POST",
        body: JSON.stringify({
          blacklisted,
          reason: blacklisted ? "Flagged during admin review." : "Reinstated by admin."
        })
      }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  const name = data?.fullName ?? "Student";
  const email = data?.email ?? "";
  const score = data?.reliability?.score ?? 0;
  const idStatus = data?.profile?.idStatus ?? "email_pending";
  const repaidCount = data?.loans?.filter((loan) => loan.status === "repaid").length ?? 0;
  const loanCount = data?.loans?.length ?? 0;
  const pendingId = idStatus === "id_pending";
  const busy = verify.isPending || blacklist.isPending;

  return (
    <Screen tabBar={false}>
      <TopBar back title="Student" />
      {!id ? (
        <GlassCard>
          <Text className="text-base font-semibold text-pula-muted">Open a student from the list to review their details.</Text>
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <View className="flex-row items-center gap-4">
              <View className="h-16 w-16 items-center justify-center bg-pula-mist" style={{ borderRadius: radius.md }}>
                <UserRound color={colors.blue} size={iconSize.lg} />
              </View>
              <View className="flex-1">
                <Text className="text-xl font-extrabold text-pula-ink">{name}</Text>
                <Text className="mt-1 text-sm text-pula-muted">{email}</Text>
              </View>
              <StatusPill
                label={data?.isBlacklisted ? "blacklisted" : idStatus.replaceAll("_", " ")}
                tone={data?.isBlacklisted ? "red" : idStatus === "verified" ? "green" : idStatus === "rejected" ? "red" : "amber"}
              />
            </View>
          </GlassCard>

          <GlassCard className="mt-6" contentClassName="items-center">
            <ReliabilityRing score={score} label={scoreBandFor(score).label} />
            <Text className="mt-4 text-base font-semibold text-pula-muted">Reliability score</Text>
          </GlassCard>

          <GlassCard className="mt-6" contentClassName="gap-4">
            <DetailRow icon={<ShieldCheck color={colors.success} size={iconSize.md} />} label="Email verified" value={data?.emailVerified ? "Yes" : "No"} />
            <DetailRow icon={<BadgeCheck color={colors.blue} size={iconSize.md} />} label="Student ID status" value={idStatus.replaceAll("_", " ")} />
            <DetailRow icon={<History color={colors.blue} size={iconSize.md} />} label="Loan history" value={`${loanCount} loans · ${repaidCount} repaid`} />
            <DetailRow icon={<CheckCircle2 color={colors.success} size={iconSize.md} />} label="Student number" value={data?.profile?.studentNumber ?? "—"} />
          </GlassCard>

          {pendingId ? (
            <View className="flex-row gap-3" style={{ marginTop: SECTION_GAP }}>
              <View className="flex-1">
                <GradientButton label="Verify ID" onPress={() => verify.mutate(true)} disabled={busy} showArrow={false} icon={<BadgeCheck color={colors.white} size={iconSize.sm} />} />
              </View>
              <View className="flex-1">
                <GradientButton label="Reject ID" variant="ghost" onPress={() => verify.mutate(false)} disabled={busy} icon={<XCircle color={colors.danger} size={iconSize.sm} />} />
              </View>
            </View>
          ) : null}

          <GradientButton
            label={data?.isBlacklisted ? "Reinstate student" : "Blacklist student"}
            variant="ghost"
            icon={<Ban color={colors.danger} size={iconSize.sm} />}
            onPress={() => blacklist.mutate(!data?.isBlacklisted)}
            disabled={busy}
            style={{ marginTop: 12 }}
          />
        </>
      )}
    </Screen>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
