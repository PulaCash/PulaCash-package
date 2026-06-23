import Svg, { Circle } from "react-native-svg";
import { Text, View } from "react-native";
import { colors } from "../theme/tokens";

/**
 * Reliability score donut. Track is a soft blue-grey (visible on white cards),
 * the progress arc starts at 12 o'clock and is tinted by score band.
 */
export function ReliabilityRing({
  score,
  label,
  size = 116
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(score, 100)) / 100;
  const center = size / 2;
  const tone = score >= 75 ? colors.success : score >= 50 ? colors.blue : colors.warning;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke="#E4ECFB" strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text className="text-[10px] font-bold uppercase tracking-[1px] text-pula-muted">Score</Text>
        <Text className="text-[34px] font-extrabold leading-[38px] text-pula-ink">{score}</Text>
        <View className="-mt-0.5 flex-row items-center">
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone, marginRight: 5 }} />
          <Text className="text-xs font-bold" style={{ color: tone }}>{label}</Text>
        </View>
      </View>
    </View>
  );
}
