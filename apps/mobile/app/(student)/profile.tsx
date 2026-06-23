import { useQuery } from "@tanstack/react-query";
import { Mail, School, ShieldCheck, UserRound } from "lucide-react-native";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { Dashboard } from "@pulacash/shared";
import { GlassCard, Divider } from "@/components/GlassCard";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { demoDashboard, demoUser } from "@/lib/demo-data";
import { endpoints } from "@/lib/endpoints";
import { useMe } from "@/lib/useMe";
import { colors, iconSize, radius } from "@/theme/tokens";

const verifiedTone = (status: string) => (status === "verified" ? "green" : status === "rejected" ? "red" : "amber");

export default function ProfileScreen() {
  const me = useMe();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<Dashboard>(endpoints.student.dashboard).catch(() => demoDashboard),
    initialData: demoDashboard
  });

  const name = dashboard.data?.student.name ?? me.data?.fullName ?? "Student";
  const initials = dashboard.data?.student.initials ?? name.slice(0, 2).toUpperCase();
  const email = me.data?.email ?? demoUser.email;
  const institution = dashboard.data?.student.institution ?? "Student institution";
  const verification = dashboard.data?.student.verificationStatus ?? "email_pending";

  return (
    <Screen>
      <TopBar title="Profile" bell />
      <GlassCard>
        <View className="items-center">
          <View className="h-24 w-24 items-center justify-center bg-pula-mist" style={{ borderRadius: radius.xl }}>
            <Text className="text-3xl font-extrabold text-pula-ink">{initials}</Text>
          </View>
          <Text className="mt-4 text-2xl font-extrabold text-pula-ink">{name}</Text>
          <Text className="mt-1 text-sm text-pula-muted">{email}</Text>
          <View className="mt-4">
            <StatusPill label={`Student ${verification.replaceAll("_", " ")}`} tone={verifiedTone(verification)} />
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mt-6" contentClassName="gap-4">
        <ProfileRow icon={<UserRound color={colors.blue} size={iconSize.md} />} label="Name" value={name} />
        <Divider />
        <ProfileRow icon={<Mail color={colors.blue} size={iconSize.md} />} label="Student email" value={email} />
        <Divider />
        <ProfileRow icon={<School color={colors.blue} size={iconSize.md} />} label="Institution" value={institution} />
        <Divider />
        <ProfileRow
          icon={<ShieldCheck color={colors.blue} size={iconSize.md} />}
          label="Verification status"
          value={verification.replaceAll("_", " ")}
        />
      </GlassCard>
    </Screen>
  );
}

function ProfileRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
