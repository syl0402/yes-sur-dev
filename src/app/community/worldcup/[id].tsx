// ys-145 월드컵 · F-608 (시작 → 둘 중 하나 고르기 → 우승 → 랭킹·그룹 1위·댓글. 첫 판만 집계·포인트)
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import Comments from "@/components/community/Comments";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ProgressBar from "@/components/ui/ProgressBar";
import SectionHeader from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, shadow, spacing } from "@/constants/theme";
import { errorMessage } from "@/lib/errors";
import { formatPoints } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";
import {
  type Bracket,
  type Candidate,
  type Worldcup,
  type WorldcupResult,
  currentPair,
  pick,
  roundLabel,
  startBracket,
} from "@/lib/worldcup";

type Phase = "intro" | "play" | "win" | "result";

export default function WorldcupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, null = 없음
  const [cup, setCup] = useState<Worldcup | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("intro");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [champion, setChampion] = useState<Candidate | null>(null);
  const [reward, setReward] = useState(0);
  const [result, setResult] = useState<WorldcupResult | null>(null);

  const loadResult = useCallback(async () => {
    const { data } = await supabase.rpc("get_worldcup_result", { p_id: Number(id) });
    setResult((data as WorldcupResult | null) ?? null);
  }, [id]);

  useEffect(() => {
    supabase.rpc("get_worldcup", { p_id: Number(id) }).then(({ data, error }) => {
      if (error || !data) {
        setCup(null);
        return;
      }
      const w = data as Worldcup;
      setCup(w);
      // 이미 한 사람은 결과부터 (다시 하기는 결과 화면에서)
      if (w.played) {
        setPhase("result");
        loadResult();
      }
    });
  }, [id, loadResult]);

  if (cup === undefined) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "월드컵" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (cup === null) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "월드컵" }} />
        <EmptyState title="월드컵을 찾을 수 없어요" emoji="🏆" />
      </View>
    );
  }

  const start = () => {
    setBracket(startBracket(cup.candidates));
    setChampion(null);
    setReward(0);
    setPhase("play");
  };

  const choose = async (side: 0 | 1) => {
    if (!bracket) return;
    const { bracket: next, champion: won } = pick(bracket, side);
    setBracket(next);
    if (!won) return;

    setChampion(won);
    setPhase("win");
    // 첫 판만 저장·포인트. 다시 하기는 저장하지 않는다 (금액은 서버가 정함)
    if (!cup.played) {
      const { data, error } = await supabase.rpc("submit_worldcup", { p_id: cup.id, p_matches: next.matches });
      if (error && error.message !== "already_played") {
        showNotice("결과를 저장하지 못했어요", errorMessage(error));
        return;
      }
      setReward((data as { reward: number } | null)?.reward ?? 0);
      setCup({ ...cup, played: true });
    }
    loadResult();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "월드컵" }} />

      {phase === "intro" && (
        <Card style={styles.introCard}>
          <Badge label={roundLabel(cup.size)} tone="accent" />
          <Text style={styles.title}>{cup.title}</Text>
          {cup.description ? <Text style={styles.description}>{cup.description}</Text> : null}
          <Text style={styles.muted}>
            둘 중 하나를 {cup.size - 1}번 고르면 우승이 정해져요.
            {cup.played ? "\n이미 참여했어요. 다시 하면 결과에 들어가지 않아요." : ""}
          </Text>
          <Button title="시작하기" onPress={start} />
        </Card>
      )}

      {phase === "play" && bracket && <Match bracket={bracket} size={cup.size} onPick={choose} />}

      {phase === "win" && champion && (
        <View style={styles.win}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.winName}>{champion.name}</Text>
          <Text style={styles.muted}>우승!</Text>
          {reward > 0 && (
            <View style={styles.rewardPill}>
              <Text style={styles.rewardText}>+{formatPoints(reward)}</Text>
            </View>
          )}
          <Button title="다른 사람들은? 랭킹 보기" onPress={() => setPhase("result")} style={styles.winButton} />
        </View>
      )}

      {phase === "result" && (
        <>
          <Card>
            <Text style={styles.title}>{cup.title}</Text>
            <Text style={styles.muted}>
              {roundLabel(cup.size)} · {result ? `${result.plays}명 참여` : "불러오는 중"}
            </Text>
          </Card>

          {result && <Ranking result={result} />}

          <Button title="다시 하기 (결과에 안 들어가요)" variant="outline" onPress={start} />

          <SectionHeader title="댓글" />
          <Comments type="worldcup" id={cup.id} />
        </>
      )}
    </ScrollView>
  );
}

// 둘 중 하나 고르기 (위·아래 큰 카드)
function Match({ bracket, size, onPick }: { bracket: Bracket; size: number; onPick: (side: 0 | 1) => void }) {
  const [a, b] = currentPair(bracket);
  const pairs = bracket.round.length / 2;
  return (
    <>
      <View style={styles.matchTop}>
        <Text style={styles.roundLabel}>{roundLabel(bracket.round.length)}</Text>
        {pairs > 1 && (
          <Text style={styles.muted}>
            {bracket.pair + 1} / {pairs}
          </Text>
        )}
      </View>
      <ProgressBar value={bracket.matches.length / (size - 1)} />
      <Choice name={a.name} onPress={() => onPick(0)} />
      <Text style={styles.vs}>VS</Text>
      <Choice name={b.name} onPress={() => onPick(1)} />
    </>
  );
}

function Choice({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
      <Text style={styles.choiceText}>{name}</Text>
    </Pressable>
  );
}

// 랭킹: 우승 비율 · 1:1 승률 + 계열별·성별 1위
function Ranking({ result }: { result: WorldcupResult }) {
  const majors = result.groups.filter((g) => g.dim === "major");
  const genders = result.groups.filter((g) => g.dim === "gender");
  return (
    <>
      <SectionHeader title="랭킹" subtitle="우승 비율 순 · 1:1 승률은 맞붙었을 때 이긴 비율" />
      <Card>
        <View style={styles.rankHead}>
          <Text style={[styles.headText, styles.rankNo]}>순위</Text>
          <Text style={[styles.headText, styles.rankName]}>후보</Text>
          <Text style={[styles.headText, styles.rankNum]}>우승</Text>
          <Text style={[styles.headText, styles.rankNum]}>1:1 승률</Text>
        </View>
        {result.ranking.map((r, i) => (
          <View key={r.id} style={styles.rankRow}>
            <Text style={[styles.rankNo, styles.rankNoText, i === 0 && styles.first]}>{i + 1}</Text>
            <View style={styles.rankName}>
              <Text style={[styles.rankNameText, i === 0 && styles.first]} numberOfLines={1}>
                {r.name}
              </Text>
              <ProgressBar value={r.win_rate / 100} height={4} />
            </View>
            <Text style={[styles.rankNum, styles.rankNumText]}>{r.win_rate}%</Text>
            <Text style={[styles.rankNum, styles.rankNumText]}>{r.match_rate}%</Text>
          </View>
        ))}
      </Card>

      {(majors.length > 0 || genders.length > 0) && (
        <>
          <SectionHeader title="그룹별 1위" subtitle="인원이 적은 그룹은 숨겨요" />
          <Card>
            {[...majors, ...genders].map((g) => (
              <View key={`${g.dim}:${g.label}`} style={styles.groupRow}>
                <Text style={styles.groupLabel}>{g.label}</Text>
                <Text style={[styles.groupTop, g.hidden && styles.muted]}>
                  {g.hidden ? "인원이 적어 숨김" : `${g.top} · ${g.n}명`}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  introCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
  },
  description: {
    fontSize: fontSize.body,
    color: colors.text,
    lineHeight: 24,
  },
  muted: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  matchTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  roundLabel: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.primary,
  },
  choice: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  choicePressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: {
    fontSize: fontSize.title,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  vs: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.textSubtle,
    textAlign: "center",
  },
  win: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  trophy: {
    fontSize: 72,
  },
  winName: {
    fontSize: fontSize.hero,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
  },
  rewardPill: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  rewardText: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.onAccent,
  },
  winButton: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  rankHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headText: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rankNo: {
    width: 28,
    textAlign: "center",
  },
  rankNoText: {
    fontSize: fontSize.body,
    fontWeight: "800",
    color: colors.textSubtle,
  },
  rankName: {
    flex: 1,
    gap: 4,
  },
  rankNameText: {
    fontSize: fontSize.body,
    fontWeight: "600",
    color: colors.text,
  },
  first: {
    color: colors.primary,
  },
  rankNum: {
    width: 56,
    textAlign: "right",
  },
  rankNumText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
  },
  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 2,
  },
  groupLabel: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  groupTop: {
    flexShrink: 1,
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
  },
});
