import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { demoStudents } from "@/lib/demo-data";
import { endpoints } from "@/lib/endpoints";
import { colors, iconSize, radius } from "@/theme/tokens";

type StudentRow = {
  id: string;
  fullName: string;
  email: string;
  isBlacklisted?: boolean;
  profile?: { idStatus?: string } | null;
  reliability?: { score?: number } | null;
};

export default function StudentsScreen() {
  const [query, setQuery] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => apiFetch<StudentRow[]>(endpoints.admin.students).catch(() => null)
  });

  const rows: StudentRow[] =
    data ??
    demoStudents.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      email: s.email,
      isBlacklisted: s.isBlacklisted,
      profile: { idStatus: s.verification },
      reliability: { score: s.reliability }
    }));

  const term = query.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) => r.fullName.toLowerCase().includes(term) || r.email.toLowerCase().includes(term))
    : rows;

  return (
    <Screen tabBar={false}>
      <TopBar back title="Students" />
      <View className="mb-5 h-14 flex-row items-center bg-white px-5" style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}>
        <Search color={colors.blue} size={iconSize.md} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search students"
          placeholderTextColor="#8B96A8"
          className="ml-3 flex-1 text-base font-semibold text-pula-ink"
        />
      </View>
      {filtered.map((student) => {
        const status = student.profile?.idStatus ?? "email_pending";
        return (
          <Pressable
            key={student.id}
            className="mb-4 bg-white p-5"
            style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}
            onPress={() => router.push({ pathname: "/student-detail", params: { id: student.id } })}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-pula-ink">{student.fullName}</Text>
                <Text className="mt-1 text-sm text-pula-muted">{student.email}</Text>
                <Text className="mt-2 text-sm font-bold text-pula-blue">Score {student.reliability?.score ?? "—"}</Text>
              </View>
              <StatusPill
                label={status.replaceAll("_", " ")}
                tone={status === "verified" ? "green" : status === "rejected" ? "red" : "amber"}
              />
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}
