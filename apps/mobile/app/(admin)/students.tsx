import { router } from "expo-router";
import { Search } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { demoStudents } from "@/lib/demo-data";
import { colors, iconSize, radius } from "@/theme/tokens";

export default function StudentsScreen() {
  return (
    <Screen tabBar={false}>
      <TopBar back title="Students" />
      <View className="mb-5 h-14 flex-row items-center bg-white px-5" style={{ borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}>
        <Search color={colors.blue} size={iconSize.md} />
        <TextInput placeholder="Search students" placeholderTextColor="#8B96A8" className="ml-3 flex-1 text-base font-semibold text-pula-ink" />
      </View>
      {demoStudents.map((student) => (
        <Pressable
          key={student.id}
          className="mb-4 bg-white p-5"
          style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line }}
          onPress={() => router.push("/student-detail")}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-extrabold text-pula-ink">{student.fullName}</Text>
              <Text className="mt-1 text-sm text-pula-muted">{student.email}</Text>
              <Text className="mt-2 text-sm font-bold text-pula-blue">Score {student.reliability}</Text>
            </View>
            <StatusPill label={student.verification.replaceAll("_", " ")} tone={student.verification === "verified" ? "green" : "amber"} />
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}
