import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, MessageSquarePlus, Send, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Feedback, FeedbackCategory, feedbackCategories, feedbackCategoryLabels } from "@pulacash/shared";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { StatusPill } from "@/components/StatusPill";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { colors, iconSize, radius } from "@/theme/tokens";

const toneFor: Record<FeedbackCategory, "blue" | "green" | "amber" | "red"> = {
  bug: "red",
  feature: "blue",
  general: "amber",
  praise: "green"
};

export default function FeedbackScreen() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [message, setMessage] = useState("");

  const board = useQuery({
    queryKey: ["feedback"],
    queryFn: () => apiFetch<Feedback[]>(endpoints.feedback.list).catch(() => [] as Feedback[]),
    initialData: [] as Feedback[]
  });

  const submit = useMutation({
    mutationFn: () => apiFetch<Feedback>(endpoints.feedback.create, { method: "POST", body: JSON.stringify({ category, message: message.trim() }) }),
    onSuccess: async () => {
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["feedback"] });
    }
  });

  const vote = useMutation({
    mutationFn: (id: string) => apiFetch(endpoints.feedback.vote(id), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback"] })
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(endpoints.feedback.remove(id), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback"] })
  });

  return (
    <Screen tabBar={false}>
      <TopBar back title="Feedback board" />
      <Text className="text-3xl font-extrabold text-pula-ink">Help shape PulaCash</Text>
      <Text className="mt-2 text-base leading-6 text-pula-muted">Share an idea or report an issue, and upvote what matters to you.</Text>

      <GlassCard className="mt-6" contentClassName="gap-3">
        <View className="flex-row items-center gap-2">
          <MessageSquarePlus color={colors.blue} size={iconSize.md} />
          <Text className="text-base font-extrabold text-pula-ink">Post to the board</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {feedbackCategories.map((c) => {
            const selected = c === category;
            return (
              <Pressable
                key={c}
                className="px-4 py-2"
                style={{ borderRadius: radius.pill, backgroundColor: selected ? colors.blue : colors.mist }}
                onPress={() => setCategory(c)}
              >
                <Text className="text-sm font-bold" style={{ color: selected ? colors.white : colors.blue }}>{feedbackCategoryLabels[c]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View className="bg-pula-mist px-4 py-3" style={{ borderRadius: radius.md }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="What would make PulaCash better?"
            placeholderTextColor="#8B96A8"
            multiline
            className="min-h-[64px] text-base font-semibold text-pula-ink"
            style={{ textAlignVertical: "top" }}
            maxLength={1000}
          />
        </View>
        {submit.isError ? <Text className="text-sm font-semibold text-red-500">Could not post. Try again.</Text> : null}
        {submit.isPending ? (
          <View className="items-center py-2">
            <ActivityIndicator color={colors.blue} />
          </View>
        ) : (
          <GradientButton label="Post feedback" icon={<Send color={colors.white} size={iconSize.sm} />} showArrow={false} disabled={message.trim().length < 4} onPress={() => submit.mutate()} />
        )}
      </GlassCard>

      <Text className="mt-7 text-base font-extrabold text-pula-muted">Top feedback</Text>
      {board.data.length === 0 ? (
        <GlassCard className="mt-3">
          <Text className="text-base text-pula-muted">No feedback yet — be the first to post.</Text>
        </GlassCard>
      ) : (
        board.data.map((item) => (
          <GlassCard key={item.id} className="mt-3">
            <View className="flex-row gap-3">
              <Pressable
                className="items-center justify-center px-3 py-1"
                style={{ borderRadius: radius.md, backgroundColor: item.hasVoted ? colors.blue : colors.mist, minWidth: 52 }}
                onPress={() => vote.mutate(item.id)}
              >
                <ChevronUp color={item.hasVoted ? colors.white : colors.blue} size={20} strokeWidth={2.6} />
                <Text className="text-sm font-extrabold" style={{ color: item.hasVoted ? colors.white : colors.blue }}>{item.voteCount}</Text>
              </Pressable>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <StatusPill label={feedbackCategoryLabels[item.category]} tone={toneFor[item.category]} />
                  <Text className="text-sm font-semibold text-pula-muted">{item.authorName}</Text>
                </View>
                <Text className="mt-2 text-base leading-5 text-pula-ink">{item.message}</Text>
                {item.isMine ? (
                  <Pressable className="mt-2 flex-row items-center gap-1.5 self-start" onPress={() => remove.mutate(item.id)}>
                    <Trash2 color={colors.danger} size={iconSize.sm} />
                    <Text className="text-sm font-semibold text-red-500">Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </GlassCard>
        ))
      )}
    </Screen>
  );
}
