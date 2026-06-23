// PulaCash design tokens: white canvas, electric blue gradients, soft glass,
// and compact iOS-style controls.
export const colors = {
  ink: "#071532",
  muted: "#758096",
  blue: "#075DFF",
  blueDeep: "#003FD8",
  blueSoft: "#EAF2FF",
  cyan: "#32D5F4",
  mist: "#F1F6FF",
  line: "#DDE8FA",
  white: "#FFFFFF",
  success: "#12B981",
  successSoft: "#EAFBF4",
  warning: "#F5A524",
  danger: "#EF4444"
} as const;

export const gradients = {
  brand: ["#45D8F2", "#0A75FF", "#073CF0"] as const,
  bluePanel: ["#45D8F2", "#0B77FF", "#024AFF"] as const,
  button: ["#2F7BFF", "#075DFF", "#003FD8"] as const,
  soft: ["#FFFFFF", "#F9FCFF", "#EFF6FF"] as const,
  card: ["rgba(255,255,255,0.98)", "rgba(242,247,255,0.94)"] as const,
  mint: ["#F7FFFC", "#ECFBF4"] as const
};

export const shadows = {
  soft: {
    shadowColor: "#3766C8",
    shadowOpacity: 0.09,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5
  },
  card: {
    shadowColor: "#4E6EA8",
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6
  },
  button: {
    shadowColor: colors.blue,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7
  }
};

// Corner radii — one ladder for the whole app. md = inputs/list rows,
// lg = cards & buttons, xl = hero avatars/panels, pill = chips/icon buttons.
export const radius = {
  sm: 18,
  md: 24,
  lg: 30,
  xl: 34,
  pill: 999
} as const;

// Vertical rhythm between major sections on a screen.
export const SECTION_GAP = 20;

// Single control height so buttons and inputs line up everywhere (>= 48 tap target).
export const control = {
  height: 56
} as const;

// Frosted-glass surface params (used with expo-blur BlurView).
export const glass = {
  intensity: 40,
  tint: "rgba(255,255,255,0.62)",
  // Slightly stronger fill for surfaces sitting over busy/blue backgrounds.
  tintStrong: "rgba(255,255,255,0.78)",
  border: "rgba(255,255,255,0.55)"
} as const;

// Icon size ladder so paired icons stop drifting between 20/23/25/28.
export const iconSize = {
  sm: 20,
  md: 24,
  lg: 28
} as const;
