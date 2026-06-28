import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ChevronRight, FileText, HelpCircle, LogOut, ScrollText, Shield, Sparkles, Trash2 } from "lucide-react-native";
import { Children, Fragment, ReactNode, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, TextInput, View } from "react-native";
import { Dashboard, legal } from "@pulacash/shared";
import { GlassCard, Divider } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { apiFetch, ApiError, deleteAccount, signOut } from "@/lib/api";
import { demoDashboard, demoUser } from "@/lib/demo-data";
import { endpoints } from "@/lib/endpoints";
import { useMe } from "@/lib/useMe";
import { colors, control, iconSize, radius } from "@/theme/tokens";

export default function MoreScreen() {
  const queryClient = useQueryClient();
  const me = useMe();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<Dashboard>(endpoints.student.dashboard).catch(() => demoDashboard),
    initialData: demoDashboard
  });

  const name = dashboard.data?.student.name ?? me.data?.fullName ?? "Student";
  const initials = dashboard.data?.student.initials ?? name.slice(0, 2).toUpperCase();
  const email = me.data?.email ?? demoUser.email;
  const isAdmin = me.data?.role === "admin";
  const isPlus = (me.data?.subscriptionTier ?? "free") === "plus";

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");

  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/welcome");
    }
  });

  async function logout() {
    await signOut();
    queryClient.clear();
    router.replace("/welcome");
  }

  return (
    <Screen>
      <TopBar title="Settings" search />
      <GlassCard>
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center bg-pula-mist" style={{ borderRadius: radius.md }}>
            <Text className="text-xl font-extrabold text-pula-ink">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-extrabold text-pula-ink">{name}</Text>
            <Text className="mt-1 text-sm text-pula-muted">{email}</Text>
          </View>
        </View>
      </GlassCard>

      <SettingsGroup title="Account">
        <SettingsRow
          icon={<Sparkles color={colors.blue} size={iconSize.md} />}
          label="PulaCash+ membership"
          trailing={isPlus ? "Active" : "Free"}
          onPress={() => router.push("/membership")}
        />
      </SettingsGroup>

      <SettingsGroup title="Legal">
        <SettingsRow icon={<ScrollText color={colors.blue} size={iconSize.md} />} label="Terms of Use" onPress={() => router.push("/terms")} />
        <SettingsRow icon={<FileText color={colors.blue} size={iconSize.md} />} label="Privacy Policy" onPress={() => router.push("/privacy")} />
      </SettingsGroup>

      <SettingsGroup title="Support">
        <SettingsRow
          icon={<HelpCircle color={colors.blue} size={iconSize.md} />}
          label="Help & support"
          onPress={() => Linking.openURL(`mailto:${legal.contactEmail}`)}
        />
        {isAdmin ? (
          <SettingsRow icon={<Shield color={colors.blue} size={iconSize.md} />} label="Admin dashboard" onPress={() => router.push("/admin")} />
        ) : null}
      </SettingsGroup>

      <Pressable onPress={logout}>
        <GlassCard className="mt-5">
          <View className="flex-row items-center gap-3">
            <LogOut color={colors.danger} size={iconSize.md} />
            <Text className="text-base font-extrabold text-red-500">Log out</Text>
          </View>
        </GlassCard>
      </Pressable>

      {/* Danger zone: in-app account deletion (App Store requirement). */}
      {confirmingDelete ? (
        <GlassCard className="mt-5" contentClassName="gap-3">
          <Text className="text-base font-extrabold text-pula-ink">Delete your account?</Text>
          <Text className="text-sm leading-5 text-pula-muted">
            This permanently erases your profile and personal data. Enter your password to confirm.
          </Text>
          <View className="h-14 flex-row items-center bg-pula-mist px-4" style={{ borderRadius: radius.md }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#8B96A8"
              secureTextEntry
              autoCapitalize="none"
              className="flex-1 text-base font-semibold text-pula-ink"
            />
          </View>
          {remove.isError ? (
            <Text className="text-sm font-semibold text-red-500">
              {remove.error instanceof ApiError ? remove.error.message : "Could not delete the account."}
            </Text>
          ) : null}
          {remove.isPending ? (
            <View className="items-center justify-center" style={{ height: control.height }}>
              <ActivityIndicator color={colors.danger} />
            </View>
          ) : (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <GradientButton label="Cancel" variant="ghost" onPress={() => { setConfirmingDelete(false); setPassword(""); }} />
              </View>
              <View className="flex-1">
                <GradientButton label="Delete" variant="ghost" disabled={password.length < 8} icon={<Trash2 color={colors.danger} size={iconSize.sm} />} onPress={() => remove.mutate()} />
              </View>
            </View>
          )}
        </GlassCard>
      ) : (
        <Pressable className="mt-4 items-center py-3" onPress={() => setConfirmingDelete(true)}>
          <Text className="text-sm font-semibold text-pula-muted">Delete account</Text>
        </Pressable>
      )}

      <Text className="mt-4 text-center text-xs text-pula-muted">PulaCash · Operated under {legal.jurisdiction} law</Text>
    </Screen>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  // Place dividers *between* rows only — no dangling line after the last row.
  const rows = Children.toArray(children);
  return (
    <GlassCard className="mt-5">
      <Text className="mb-1 text-base font-extrabold text-pula-muted">{title}</Text>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Divider /> : null}
          {row}
        </Fragment>
      ))}
    </GlassCard>
  );
}

function SettingsRow({ icon, label, trailing, onPress }: { icon: ReactNode; label: string; trailing?: string; onPress?: () => void }) {
  return (
    <Pressable className="flex-row items-center py-4" onPress={onPress}>
      <View className="h-10 w-10 items-center justify-center rounded-2xl bg-pula-mist">{icon}</View>
      <Text className="ml-3 flex-1 text-base font-semibold text-pula-ink">{label}</Text>
      {trailing ? <Text className="mr-2 font-bold text-pula-blue">{trailing}</Text> : null}
      <ChevronRight color={colors.ink} size={iconSize.md} />
    </Pressable>
  );
}
