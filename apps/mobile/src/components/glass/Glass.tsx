// One place that knows about Apple's Liquid Glass.
//
// Real Liquid Glass (GPU refraction + the metaball morph) only exists on a
// native iOS 26 build. Everywhere else — Android, older iOS, Expo Go, web — the
// expo-glass-effect components silently degrade to a plain transparent <View>
// (no blur at all), so this module supplies an expo-blur fallback itself and
// gates everything behind `liquidGlassAvailable`.
import { BlurView } from "expo-blur";
import {
  GlassContainer,
  GlassView,
  type GlassStyle,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable
} from "expo-glass-effect";
import { ReactNode } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { glass } from "../../theme/tokens";

// Computed once. isGlassEffectAPIAvailable() guards iOS 26 *beta* builds where
// the API can be missing and would crash on first use. Both calls touch the
// native module, which throws when it isn't linked (Expo Go) — hence try/catch.
function detectLiquidGlass(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export const liquidGlassAvailable = detectLiquidGlass();

// expo-blur tint that best mimics frosted glass on our light theme.
const FALLBACK_BLUR_TINT = Platform.OS === "ios" ? "systemChromeMaterialLight" : "light";

export type GlassSurfaceProps = {
  children?: ReactNode;
  /** Layout + shape. Put borderRadius / size / borderWidth here. */
  style?: StyleProp<ViewStyle>;
  /** 'regular' = frosted refraction (default), 'clear' = more see-through. */
  effect?: GlassStyle;
  /** Brand/colour tint so the glass has something to read against on white. */
  tint?: string;
  /** Touch glint — native only. */
  interactive?: boolean;
  /** Fallback (no Liquid Glass) blur strength. */
  fallbackIntensity?: number;
  /** Fallback fill painted over the blur to keep content legible on white. */
  fallbackFill?: string;
  /** expo-blur tint for the fallback. */
  fallbackBlurTint?: React.ComponentProps<typeof BlurView>["tint"];
};

/**
 * A single rounded glass surface. Renders Apple Liquid Glass when available,
 * otherwise an expo-blur frosted panel with the same footprint. Children render
 * on top of the glass in both modes.
 */
export function GlassSurface({
  children,
  style,
  effect = "regular",
  tint,
  interactive = false,
  fallbackIntensity = glass.intensity,
  fallbackFill = glass.tint,
  fallbackBlurTint = FALLBACK_BLUR_TINT
}: GlassSurfaceProps) {
  if (liquidGlassAvailable) {
    return (
      <GlassView
        glassEffectStyle={effect}
        tintColor={tint}
        isInteractive={interactive}
        // overflow:hidden clips children to the rounded shape.
        style={[{ overflow: "hidden" }, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <BlurView intensity={fallbackIntensity} tint={fallbackBlurTint} style={StyleSheet.absoluteFill} />
      {fallbackFill ? <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackFill }]} /> : null}
      {children}
    </View>
  );
}

export type GlassMergeContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Distance at which sibling glass shapes start melting into one another — this
   * is what produces the "two drops merging" morph as the tab lens travels.
   * No effect in the fallback.
   */
  spacing?: number;
};

/**
 * Wraps sibling glass shapes so they merge (the metaball morph). A lone glass
 * view never morphs by itself — it must live inside this container. In the
 * fallback this is just a transparent passthrough.
 */
export function GlassMergeContainer({ children, style, spacing }: GlassMergeContainerProps) {
  if (liquidGlassAvailable) {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }
  return <View style={style}>{children}</View>;
}
