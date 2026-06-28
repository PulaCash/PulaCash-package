import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Check, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { membership, PaymentMethod, paymentMethodLabels, paymentMethods } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { ApiError, cancelSubscription, subscribeToPlus } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { colors, control, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

export default function MembershipScreen() {
  const queryClient = useQueryClient();
  const me = useMe();
  const isPlus = me.data?.subscriptionTier === "plus";
  const [method, setMethod] = useState<PaymentMethod>("orange_money");

  const subscribe = useMutation({
    mutationFn: () => subscribeToPlus(method),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    }
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    }
  });

  const error =
    subscribe.error instanceof ApiError ? subscribe.error.message : subscribe.error ? "Something went wrong." : null;

  return (
    <Screen tabBar={false}>
      <TopBar back title="PulaCash+" />
      <GlassCard fill={colors.blue}>
        <View className="flex-row items-center gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/20">
            <Sparkles color={colors.white} size={iconSize.lg} />
          </View>
          <View className="flex-1">
            <Text className="text-3xl font-extrabold text-white">PulaCash+</Text>
            <Text className="mt-1 text-base text-white/85">
              P{membership.plus.priceBwp}/month · cancel anytime
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mt-6" contentClassName="gap-3">
        <Text className="text-sm font-bold uppercase text-pula-muted">What you get</Text>
        {membership.plus.benefits.map((benefit) => (
          <View key={benefit} className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-pula-blue">
              <Check color={colors.white} size={18} />
            </View>
            <Text className="flex-1 text-base font-semibold text-pula-ink">{benefit}</Text>
          </View>
        ))}
      </GlassCard>

      {isPlus ? (
        <>
          <GlassCard className="mt-6">
            <Text className="text-base font-extrabold text-pula-ink">You're on PulaCash+</Text>
            <Text className="mt-1 text-sm text-pula-muted">
              {me.data?.subscriptionRenewsAt ? `Renews ${me.data.subscriptionRenewsAt.slice(0, 10)}.` : "Active."}
            </Text>
          </GlassCard>
          {cancel.isPending ? (
            <View className="items-center justify-center" style={{ height: control.height, marginTop: SECTION_GAP }}>
              <ActivityIndicator color={colors.blue} />
            </View>
          ) : (
            <GradientButton label="Cancel membership" variant="ghost" onPress={() => cancel.mutate()} style={{ marginTop: SECTION_GAP }} />
          )}
        </>
      ) : (
        <>
          <GlassCard className="mt-6" contentClassName="gap-3">
            <Text className="text-sm font-bold uppercase text-pula-muted">Pay with</Text>
            {paymentMethods.map((option) => {
              const selected = option === method;
              return (
                <Pressable
                  key={option}
                  className="flex-row items-center justify-between px-4 py-3"
                  style={{ borderRadius: radius.md, backgroundColor: selected ? colors.blueSoft : colors.mist, borderWidth: 1, borderColor: selected ? colors.blue : "transparent" }}
                  onPress={() => setMethod(option)}
                >
                  <Text className="font-semibold" style={{ color: selected ? colors.blue : colors.ink }}>{paymentMethodLabels[option]}</Text>
                  {selected ? <Check color={colors.blue} size={iconSize.sm} /> : null}
                </Pressable>
              );
            })}
          </GlassCard>

          {error ? <Text className="mt-4 text-sm font-semibold text-red-500">{error}</Text> : null}
          {subscribe.isPending ? (
            <View className="items-center justify-center bg-pula-blue" style={{ height: control.height, borderRadius: radius.lg, marginTop: SECTION_GAP }}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : (
            <GradientButton label={`Subscribe · P${membership.plus.priceBwp}/mo`} onPress={() => subscribe.mutate()} style={{ marginTop: SECTION_GAP }} />
          )}
          <Text className="mt-4 text-center text-xs text-pula-muted">
            Billed via your selected payment method, not the App Store. Cancel anytime.
          </Text>
        </>
      )}
    </Screen>
  );
}
