import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Screen } from "@/components/Screen";

// Branded launch screen (the one the user wants kept). The native splash is now
// a plain brand-blue color, so this is the only screen showing the PulaCash mark.
export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/welcome"), 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen gradient="brand" scroll={false} padded={false}>
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-6xl font-extrabold tracking-tight text-white">PulaCash</Text>
        <Text className="mt-3 text-center text-base font-semibold text-white/80">Student money, on demand</Text>
        <ActivityIndicator color="#FFFFFF" style={{ marginTop: 28 }} />
      </View>
    </Screen>
  );
}
