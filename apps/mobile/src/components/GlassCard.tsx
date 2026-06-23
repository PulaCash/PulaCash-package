import { ReactNode } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { colors, glass, radius, shadows } from "../theme/tokens";
import { GlassSurface } from "./glass/Glass";

type GlassCardProps = {
  children: ReactNode;
  /** Applied to the outer card (margins, width, position). */
  className?: string;
  /** Applied to the inner content layer (gap, items-*, flex layout of children). */
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Use an opaque white fill instead of frosted blur (better legibility on dense forms). */
  solid?: boolean;
  /** Stronger frosted tint for cards over busy/blue backgrounds. */
  strong?: boolean;
  /** Solid background color for accent cards (e.g. the blue hero card). Skips blur. */
  fill?: string;
};

const cardShadow: ViewStyle = {
  shadowColor: shadows.card.shadowColor,
  shadowOpacity: shadows.card.shadowOpacity,
  shadowRadius: shadows.card.shadowRadius,
  shadowOffset: shadows.card.shadowOffset,
  elevation: shadows.card.elevation
};

export function GlassCard({
  children,
  className = "",
  contentClassName = "",
  style,
  padded = true,
  solid = false,
  strong = false,
  fill
}: GlassCardProps) {
  const padClass = padded ? "p-5" : "";

  // Solid (opaque) card: white by default, or a custom accent fill. No blur.
  if (solid || fill) {
    const bg = fill ?? colors.white;
    const borderColor = fill ? "transparent" : colors.line;
    return (
      <View className={className} style={[{ borderRadius: radius.lg }, cardShadow, style]}>
        <View
          className={`overflow-hidden ${fill ? "" : "border"} ${padClass} ${contentClassName}`}
          style={{ borderRadius: radius.lg, borderColor, backgroundColor: bg }}
        >
          {children}
        </View>
      </View>
    );
  }

  // Frosted glass: shadow on the (unclipped) outer view; real Liquid Glass (or a
  // BlurView fallback) on the inner. A white tint keeps text legible while still
  // refracting at the edges.
  return (
    <View className={className} style={[{ borderRadius: radius.lg }, cardShadow, style]}>
      <GlassSurface
        effect="regular"
        tint={strong ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.34)"}
        style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: glass.border }}
        fallbackIntensity={glass.intensity}
        fallbackFill={strong ? glass.tintStrong : glass.tint}
      >
        <View className={`${padClass} ${contentClassName}`}>{children}</View>
      </GlassSurface>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line, opacity: 0.85 }} />;
}
