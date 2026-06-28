import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { demoAuthBypassEnabled } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { colors } from "@/theme/tokens";

export default function AdminLayout() {
  const me = useMe();

  // Admin area is gated on a verified admin session. Fail closed: anyone who is
  // not a signed-in admin is redirected away.
  if (!demoAuthBypassEnabled) {
    if (me.isPending) {
      return (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator color={colors.blue} />
        </View>
      );
    }
    if (me.isError || me.data?.role !== "admin") {
      return <Redirect href="/welcome" />;
    }
  }

  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
