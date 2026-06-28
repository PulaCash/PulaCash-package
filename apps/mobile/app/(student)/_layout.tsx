import { GlassView } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs } from "expo-router";
import { HandCoins, House, LayoutGrid, LucideIcon, UserRound, Wallet } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassMergeContainer, GlassSurface, liquidGlassAvailable } from "@/components/glass/Glass";
import { demoAuthBypassEnabled } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { colors, radius } from "@/theme/tokens";

const INACTIVE = "#8A92A3";
const ACTIVE_ICON = "#FFFFFF";

// The visible tabs, in display order. Hidden routes (apply/history/loan-status)
// are pushed screens and are excluded below via `href: null`.
const TAB_ITEMS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: "home", label: "Home", Icon: House },
  { name: "loans", label: "Loans", Icon: Wallet },
  { name: "repayments", label: "Repayments", Icon: HandCoins },
  { name: "profile", label: "Profile", Icon: UserRound },
  { name: "more", label: "More", Icon: LayoutGrid }
];

// --- Geometry (module-level so the spring helpers can share it) ---
const SCREEN_W = Dimensions.get("window").width;
const BAR_HEIGHT = 60; // keep in sync with Screen.tsx's reserved bottom space
const BAR_WIDTH = Math.min(SCREEN_W - 40, 360);
const PAD = 6; // inner horizontal padding
const ITEM_W = (BAR_WIDTH - PAD * 2) / TAB_ITEMS.length;
const LENS = Math.min(ITEM_W - 14, 48); // the moving selection blob
const LENS_TOP = (BAR_HEIGHT - LENS) / 2;

// translateX that centers the lens under tab `index`.
function lensX(index: number) {
  return PAD + index * ITEM_W + (ITEM_W - LENS) / 2;
}

// Elastic, slightly-overshooting slide (matches the iOS selection feel).
const SPRING = { stiffness: 200, damping: 18, mass: 0.85 } as const;

// Tints: the glass needs *some* colour to refract on a white canvas.
const BAR_TINT = "rgba(255,255,255,0.20)";
const LENS_TINT = "rgba(7,93,255,0.82)";

// Tight, defined shadow so the floating pill reads as a crisp object on white.
const navShadow = {
  shadowColor: "#16203A",
  shadowOpacity: 0.16,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10
};

const lensShadow = {
  shadowColor: colors.blue,
  shadowOpacity: 0.4,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 }
};

// Animate the native glass lens directly (wrapping a GlassView in a plain
// Animated.View would break GlassContainer's sibling merge).
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

export default function StudentTabs() {
  const me = useMe();

  // Require a signed-in session before any student screen renders. Fail closed.
  if (!demoAuthBypassEnabled) {
    if (me.isPending) {
      return (
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator color={colors.blue} />
        </View>
      );
    }
    if (me.isError || !me.data) {
      return <Redirect href="/welcome" />;
    }
  }

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar state={props.state} navigation={props.navigation} />}
    >
      <Tabs.Screen name="apply" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="loan-status" options={{ href: null }} />
    </Tabs>
  );
}

// Minimal shape of React Navigation's tab bar props — only what this bar uses.
type GlassTabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
};

function GlassTabBar({ state, navigation }: GlassTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 14);

  // Map the focused route to a visible-tab index. While a hidden sub-screen
  // (apply/history/loan-status) is focused, keep the lens where it last was.
  const focusedName = state.routes[state.index]?.name;
  const current = TAB_ITEMS.findIndex((t) => t.name === focusedName);
  const lastIndex = useRef(0);
  const activeIndex = current >= 0 ? current : lastIndex.current;

  const x = useSharedValue(lensX(activeIndex));

  useEffect(() => {
    if (current >= 0) lastIndex.current = current;
    x.value = withSpring(lensX(activeIndex), SPRING);
  }, [activeIndex, current, x]);

  const lensStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onPress = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    if (Platform.OS === "ios") Haptics.selectionAsync().catch(() => {});
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (name !== focusedName && !event.defaultPrevented) navigation.navigate(name);
  };

  return (
    // Full-width, taps fall through the empty sides to the content behind.
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <View style={[styles.bar, navShadow]}>
        <GlassMergeContainer spacing={24} style={StyleSheet.absoluteFill}>
          {/* The capsule */}
          <GlassSurface
            effect="regular"
            tint={BAR_TINT}
            style={[StyleSheet.absoluteFill, styles.capsule]}
            fallbackIntensity={Platform.OS === "ios" ? 50 : 22}
            fallbackFill="rgba(255,255,255,0.46)"
          />
          {/* The moving selection lens — glass that melts into the capsule on iOS 26 */}
          {liquidGlassAvailable ? (
            <AnimatedGlassView
              glassEffectStyle="regular"
              tintColor={LENS_TINT}
              isInteractive
              style={[styles.lens, lensStyle]}
            />
          ) : (
            <Animated.View style={[styles.lens, styles.lensSolid, lensShadow, lensStyle]} />
          )}
        </GlassMergeContainer>

        {/* Hairline edge so the pill stays defined on white */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.capsule,
            { borderWidth: 1, borderColor: liquidGlassAvailable ? "rgba(17,24,39,0.06)" : "rgba(17,24,39,0.10)" }
          ]}
        />
        {/* Lit top edge — only needed for the flat blur fallback */}
        {!liquidGlassAvailable ? <View pointerEvents="none" style={styles.topHighlight} /> : null}

        {/* Icons sit above the glass so the active one reads white over the lens */}
        <View pointerEvents="box-none" style={styles.iconRow}>
          {TAB_ITEMS.map((tab, i) => {
            const focused = i === activeIndex;
            const Icon = tab.Icon;
            return (
              <Pressable
                key={tab.name}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
                onPress={() => onPress(tab.name)}
                style={styles.iconSlot}
              >
                <Icon color={focused ? ACTIVE_ICON : INACTIVE} size={21} strokeWidth={2.4} />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center"
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: radius.pill
  },
  capsule: {
    borderRadius: radius.pill,
    overflow: "hidden"
  },
  lens: {
    position: "absolute",
    top: LENS_TOP,
    left: 0,
    width: LENS,
    height: LENS,
    borderRadius: LENS / 2
  },
  lensSolid: {
    backgroundColor: colors.blue
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.85)"
  },
  iconRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingHorizontal: PAD
  },
  iconSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
