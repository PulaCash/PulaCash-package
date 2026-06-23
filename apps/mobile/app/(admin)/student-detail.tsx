import { Ban, CheckCircle2, History, ShieldCheck, UserRound } from "lucide-react-native";
import { ReactNode } from "react";
import { Text, View } from "react-native";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { ReliabilityRing } from "@/components/ReliabilityRing";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { colors, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

export default function StudentDetailScreen() {
  return (
    <Screen tabBar={false}>
      <TopBar back title="Student" />
      <GlassCard>
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center bg-pula-mist" style={{ borderRadius: radius.md }}>
            <UserRound color={colors.blue} size={iconSize.lg} />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-pula-ink">Thatayotlhe Tsenang</Text>
            <Text className="mt-1 text-sm text-pula-muted">thatayotlhe.tsenang@ub.ac.bw</Text>
          </View>
          <StatusPill label="verified" tone="green" />
        </View>
      </GlassCard>

      <GlassCard className="mt-6" contentClassName="items-center">
        <ReliabilityRing score={72} label="Good" />
        <Text className="mt-4 text-base font-semibold text-pula-muted">Reliability score</Text>
      </GlassCard>

      <GlassCard className="mt-6" contentClassName="gap-4">
        <DetailRow icon={<ShieldCheck color={colors.success} size={iconSize.md} />} label="Student ID status" value="Verified" />
        <DetailRow icon={<History color={colors.blue} size={iconSize.md} />} label="Loan history" value="2 loans · 2 repaid" />
        <DetailRow icon={<CheckCircle2 color={colors.success} size={iconSize.md} />} label="Verification status" value="Eligible for review" />
      </GlassCard>

      <GradientButton label="Update verification status" style={{ marginTop: SECTION_GAP }} />
      <GradientButton label="Blacklist student" variant="ghost" icon={<Ban color={colors.danger} size={iconSize.sm} />} style={{ marginTop: 12 }} />
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
