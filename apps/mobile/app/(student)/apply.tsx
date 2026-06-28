import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { CalendarDays, Check, ReceiptText } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Dashboard, defaultBorrowAmount, defaultLoanLimits, Loan, LoanApplyResult, loanApplySchema, loanPurposes } from "@pulacash/shared";
import { z } from "zod";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { Screen } from "@/components/Screen";
import { TopBar } from "@/components/TopBar";
import { apiFetch, demoAuthBypassEnabled } from "@/lib/api";
import { createDemoLoanApplyResult, demoDashboard, demoLoans } from "@/lib/demo-data";
import { endpoints } from "@/lib/endpoints";
import { colors, control as controlTokens, iconSize, radius, SECTION_GAP } from "@/theme/tokens";

type LoanForm = z.infer<typeof loanApplySchema>;
const presets = [200, 600, 1000, 2000];

export default function ApplyScreen() {
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, setValue, formState } = useForm<LoanForm>({
    resolver: zodResolver(loanApplySchema),
    defaultValues: {
      amount: defaultBorrowAmount,
      purpose: "Books and supplies",
      expectedRepaymentDate: "2026-07-15",
      // Explicit opt-in: the borrower must actively accept the loan agreement.
      acceptedTerms: false
    }
  });
  const amount = watch("amount");
  const acceptedTerms = watch("acceptedTerms");
  const fee = Math.round(amount * defaultLoanLimits.feeRate);
  const repayment = amount + fee;

  const apply = useMutation({
    mutationFn: (input: LoanForm) => {
      if (demoAuthBypassEnabled) return Promise.resolve(createDemoLoanApplyResult(input));
      return apiFetch<LoanApplyResult>(endpoints.loans.apply, { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: async (result) => {
      if (result.status === "disbursed") {
        queryClient.setQueryData<Loan[]>(["loans"], (current) => [
          result.loan,
          ...(current ?? demoLoans).filter((loan) => loan.id !== result.loan.id)
        ]);
        queryClient.setQueryData<Dashboard>(["dashboard"], (current) => ({
          ...(current ?? demoDashboard),
          borrowing: {
            ...(current ?? demoDashboard).borrowing,
            available: 0,
            activeLoanAmount: result.loan.repaymentAmount,
            lastDisbursedAmount: result.loan.amount,
            nextDueDate: result.loan.dueDate
          }
        }));
      }
      if (!demoAuthBypassEnabled) {
        await queryClient.invalidateQueries();
      }
      if (result.status === "disbursed") {
        router.replace({ pathname: "/loan-status", params: { id: result.loan.id } });
      } else {
        router.replace({ pathname: "/loan-status", params: { applicationId: result.application.id } });
      }
    }
  });

  return (
    <Screen>
      <TopBar back title="Request loan" />
      <Text className="text-4xl font-extrabold text-pula-ink">Choose your support</Text>
      <Text className="mt-3 text-base leading-6 text-pula-muted">Small emergency loans with a clear repayment summary.</Text>

      <GlassCard className="mt-7">
        <Text className="text-sm font-bold uppercase text-pula-muted">Loan amount</Text>
        <Text className="mt-2 text-5xl font-extrabold text-pula-ink">P{amount}.00</Text>
        <View className="mt-5 flex-row gap-2.5">
          {presets.map((value) => {
            const selected = amount === value;
            return (
              <Pressable
                key={value}
                className="h-12 flex-1 items-center justify-center"
                style={{ borderRadius: radius.md, backgroundColor: selected ? colors.blue : colors.mist }}
                onPress={() => setValue("amount", value, { shouldValidate: true })}
              >
                <Text className="font-bold" style={{ color: selected ? colors.white : colors.blue }}>
                  P{value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mt-3 h-14 flex-row items-center bg-pula-mist px-5" style={{ borderRadius: radius.md }}>
          <Text className="text-base font-bold text-pula-blue">P</Text>
          <Controller
            control={control}
            name="amount"
            render={({ field: { value } }) => (
              <TextInput
                value={value ? String(value) : ""}
                onChangeText={(text) => {
                  const next = Number(text.replace(/[^0-9]/g, ""));
                  setValue("amount", Number.isFinite(next) ? next : 0, { shouldValidate: true });
                }}
                keyboardType="number-pad"
                placeholder="Enter a custom amount"
                placeholderTextColor="#8B96A8"
                className="ml-2 flex-1 text-base font-semibold text-pula-ink"
              />
            )}
          />
        </View>
        {formState.errors.amount ? (
          <Text className="mt-2 text-sm font-semibold text-red-500">Enter an amount of at least P50.</Text>
        ) : null}
      </GlassCard>

      <GlassCard className="mt-5">
        <Text className="text-sm font-bold uppercase text-pula-muted">Purpose</Text>
        <Controller
          control={control}
          name="purpose"
          render={({ field: { value, onChange } }) => (
            <View className="mt-4 gap-3">
              {loanPurposes.slice(0, 4).map((purpose) => {
                const selected = value === purpose;
                return (
                  <Pressable
                    key={purpose}
                    className="flex-row items-center justify-between px-4 py-4"
                    style={{
                      borderRadius: radius.md,
                      backgroundColor: selected ? colors.blueSoft : colors.mist,
                      borderWidth: 1,
                      borderColor: selected ? colors.blue : "transparent"
                    }}
                    onPress={() => onChange(purpose)}
                  >
                    <Text className="font-semibold" style={{ color: selected ? colors.blue : colors.ink }}>
                      {purpose}
                    </Text>
                    {selected ? <Check color={colors.blue} size={iconSize.sm} /> : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </GlassCard>

      <GlassCard className="mt-5">
        <View className="flex-row items-center gap-3">
          <CalendarDays color={colors.blue} size={iconSize.md} />
          <View className="flex-1">
            <Text className="text-sm font-bold uppercase text-pula-muted">Expected repayment date</Text>
            <Controller
              control={control}
              name="expectedRepaymentDate"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder="YYYY-MM-DD"
                  className="mt-1 text-lg font-extrabold text-pula-ink"
                />
              )}
            />
          </View>
        </View>
      </GlassCard>

      <GlassCard className="mt-5">
        <View className="mb-4 flex-row items-center gap-3">
          <ReceiptText color={colors.blue} size={iconSize.md} />
          <Text className="text-lg font-extrabold text-pula-ink">Repayment summary</Text>
        </View>
        <SummaryRow label="Amount requested" value={`P${amount}.00`} />
        <SummaryRow label="Interest (25%)" value={`P${fee}.00`} />
        <SummaryRow label="Repayment amount" value={`P${repayment}.00`} strong />
        <Text className="mt-4 text-sm font-semibold text-pula-blue">No hidden fees. Funds are sent instantly on approval.</Text>
      </GlassCard>

      <Pressable className="mt-5 flex-row items-center gap-3" onPress={() => setValue("acceptedTerms", !acceptedTerms, { shouldValidate: true })}>
        <View className="h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: acceptedTerms ? colors.blue : colors.line }}>
          {acceptedTerms ? <Check color={colors.white} size={iconSize.sm} /> : null}
        </View>
        <Text className="flex-1 text-sm leading-5 text-pula-muted">
          I accept the{" "}
          <Text className="font-extrabold text-pula-blue" onPress={() => router.push("/loan-agreement")}>loan agreement</Text>
          {" "}and repayment responsibility, and the{" "}
          <Text className="font-extrabold text-pula-blue" onPress={() => router.push("/terms")}>Terms of Use</Text>.
        </Text>
      </Pressable>
      {formState.errors.acceptedTerms ? <Text className="mt-2 text-sm text-red-500">Accept terms before submitting.</Text> : null}
      {apply.isError ? (
        <Text className="mt-3 text-sm font-semibold text-red-500">{(apply.error as Error).message}</Text>
      ) : null}

      {apply.isPending ? (
        <View className="items-center justify-center bg-pula-blue" style={{ height: controlTokens.height, borderRadius: radius.lg, marginTop: SECTION_GAP }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (
        <GradientButton label="Submit request" onPress={handleSubmit((input) => apply.mutate(input))} style={{ marginTop: SECTION_GAP }} />
      )}
    </Screen>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className={strong ? "text-base font-bold text-pula-ink" : "text-base text-pula-muted"}>{label}</Text>
      <Text className={strong ? "text-lg font-extrabold text-pula-ink" : "text-base font-semibold text-pula-ink"}>{value}</Text>
    </View>
  );
}
