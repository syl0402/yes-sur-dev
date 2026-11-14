// ys-145 월드컵 · F-608 (시작 → 둘 중 하나 고르기 → 우승 → 랭킹·그룹 1위·댓글. 첫 판만 집계·포인트)
// 2026-11-14 커뮤니티 시안 ⑤⑥③: 파랑/라임 대결 카드 · 고르면 0.4초 뒤 다음 대결 · 되돌리기 · 라운드 중간 화면 ·
// 우승(꽃가루·마스코트) · 결과(시상대·전체 순위·그룹별 1위)
import { Stack, useLocalSearchParams } from "expo-router";
import {
  type ComponentRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

import CommentComposer from "@/components/community/CommentComposer";
import Comments from "@/components/community/Comments";
import {
  ShareWorldcup,
  type WorldcupShare,
  worldcupRankLine,
} from "@/components/share/CommunityShareCards";
import SharePreviewSheet from "@/components/share/SharePreviewSheet";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Text } from "@/components/ui/Text";
import MatchView from "@/components/worldcup/MatchView";
import ResultView from "@/components/worldcup/ResultView";
import RoundBreak from "@/components/worldcup/RoundBreak";
import WinView from "@/components/worldcup/WinView";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { useCommentThread } from "@/hooks/useCommentThread";
import { errorMessage } from "@/lib/errors";
import { showNotice } from "@/lib/notice";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import {
  type Bracket,
  type Candidate,
  type Worldcup,
  type WorldcupResult,
  pick,
  roundLabel,
  startBracket,
} from "@/lib/worldcup";

// break: 라운드가 바뀔 때 중간 화면
type Phase = "intro" | "play" | "break" | "win" | "result";

export default function WorldcupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // undefined = 불러오는 중, null = 없음
  const [cup, setCup] = useState<Worldcup | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>("intro");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  // 되돌리기용: 고르기 전 대진들
  const [history, setHistory] = useState<Bracket[]>([]);
  // 중간 화면에 보여 줄 방금 끝난 라운드 후보 수
  const [lastRound, setLastRound] = useState(0);
  const [champion, setChampion] = useState<Candidate | null>(null);
  const [reward, setReward] = useState(0);
  const [result, setResult] = useState<WorldcupResult | null>(null);
  // 그룹별 1위를 보여 줄 최소 인원 (point_rules low_response_warning)
  const [groupMin, setGroupMin] = useState(10);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // 댓글 (결과 화면에서만 목록 + 아래 고정 입력칸)
  const thread = useCommentThread("worldcup", Number(id));
  // 결과 공유 미리보기 창 (스토리 1080×1920)
  const [shareOpen, setShareOpen] = useState(false);

  const loadResult = useCallback(async () => {
    const { data } = await supabase.rpc("get_worldcup_result", {
      p_id: Number(id),
    });
    setResult((data as WorldcupResult | null) ?? null);
  }, [id]);

  useEffect(() => {
    fetchRules(["low_response_warning"]).then((r) =>
      setGroupMin(r.low_response_warning ?? 10),
    );
    supabase
      .rpc("get_worldcup", { p_id: Number(id) })
      .then(({ data, error }) => {
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

  // 화면이 바뀌면 맨 위로
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [phase]);

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
    setHistory([]);
    setChampion(null);
    setReward(0);
    setPhase("play");
  };

  const choose = async (side: 0 | 1) => {
    if (!bracket) return;
    const { bracket: next, champion: won } = pick(bracket, side);
    setHistory((h) => [...h, bracket]);
    setBracket(next);
    if (!won) {
      // 라운드가 끝났으면 중간 화면 ("8강 진출!")
      if (next.round.length < bracket.round.length) {
        setLastRound(bracket.round.length);
        setPhase("break");
      }
      return;
    }

    setChampion(won);
    setPhase("win");
    // 첫 판만 저장·포인트. 다시 하기는 저장하지 않는다 (금액은 서버가 정함)
    if (!cup.played) {
      const { data, error } = await supabase.rpc("submit_worldcup", {
        p_id: cup.id,
        p_matches: next.matches,
      });
      if (error && error.message !== "already_played") {
        showNotice("결과를 저장하지 못했어요", errorMessage(error));
        return;
      }
      setReward((data as { reward: number } | null)?.reward ?? 0);
      setCup({ ...cup, played: true });
    }
    loadResult();
  };

  // 공유 카드: 내 1위 = 방금 끝낸 판의 우승 후보, 없으면 서버가 준 내 첫 판 우승 후보
  const myId = champion?.id ?? result?.my_winner ?? null;
  const myIndex =
    result && myId !== null
      ? result.ranking.findIndex((r) => r.id === myId)
      : -1;
  const shareData: WorldcupShare | null =
    result && myIndex >= 0
      ? {
          round: roundLabel(cup.size),
          title: cup.title,
          plays: result.plays,
          mine: result.ranking[myIndex].name,
          rankLine: worldcupRankLine(myIndex, result.ranking[myIndex].wins),
          top: result.ranking
            .slice(0, 3)
            .map((r) => ({
              name: r.name,
              rate: r.win_rate,
              mine: r.id === myId,
            })),
        }
      : null;

  // 이전 선택 다시 하기
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setBracket(prev);
    setPhase("play");
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scroll}
        style={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen
          options={{ title: phase === "result" ? "월드컵 결과" : "월드컵" }}
        />

        {phase === "intro" && (
          <Card style={styles.introCard}>
            <Badge label={roundLabel(cup.size)} tone="accent" />
            <Text style={styles.title}>{cup.title}</Text>
            {cup.description ? (
              <Text style={styles.description}>{cup.description}</Text>
            ) : null}
            <Text style={styles.muted}>
              둘 중 하나를 {cup.size - 1}번 고르면 우승이 정해져요.
              {cup.played
                ? "\n이미 참여했어요. 다시 하면 결과에 들어가지 않아요."
                : ""}
            </Text>
            <Button title="시작하기" onPress={start} />
          </Card>
        )}

        {phase === "play" && bracket && (
          <MatchView
            bracket={bracket}
            onPick={choose}
            onUndo={history.length > 0 ? undo : undefined}
          />
        )}

        {phase === "break" && bracket && (
          <RoundBreak
            from={lastRound}
            winners={bracket.round}
            onStart={() => setPhase("play")}
            onUndo={undo}
          />
        )}

        {phase === "win" && champion && (
          <WinView
            champion={champion}
            title={cup.title}
            size={cup.size}
            result={result}
            reward={reward}
            onRanking={() => setPhase("result")}
            onReplay={start}
          />
        )}

        {phase === "result" && (
          <>
            <View style={styles.head}>
              <View style={styles.headBadge}>
                <Text style={styles.headBadgeText}>
                  {roundLabel(cup.size)}
                  {result ? ` · ${result.plays}명 참여` : ""}
                </Text>
              </View>
              <Text style={styles.title}>{cup.title}</Text>
            </View>

            {result ? (
              <ResultView result={result} groupMin={groupMin} />
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}

            <View style={styles.replay}>
              <View style={styles.replayRow}>
                <Button
                  title="다시 하기"
                  variant="outline"
                  onPress={start}
                  style={styles.replayButton}
                />
                {shareData && (
                  <Button
                    title="결과 공유"
                    onPress={() => setShareOpen(true)}
                    style={styles.replayButton}
                  />
                )}
              </View>
              <Text style={styles.replayNote}>
                다시 하기는 결과에 반영되지 않아요
              </Text>
            </View>

            <Comments thread={thread} />
          </>
        )}
      </ScrollView>
      {phase === "result" && <CommentComposer thread={thread} />}

      {/* 공유 미리보기 창 */}
      {shareOpen && phase === "result" && shareData && (
        <SharePreviewSheet
          shape="story"
          kind="worldcup"
          onClose={() => setShareOpen(false)}
          renderCard={(width, ref) => (
            <ShareWorldcup ref={ref} width={width} data={shareData} />
          )}
        />
      )}
    </View>
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
  head: {
    gap: spacing.sm,
  },
  // "16강 · n명 참여" (시안: 연노랑 바탕 + 갈색 글자)
  headBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  headBadgeText: {
    fontSize: fontSize.caption,
    fontWeight: "700",
    color: colors.warning,
  },
  replayRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  replayButton: {
    flex: 1,
  },
  replay: {
    gap: spacing.xs,
  },
  replayNote: {
    fontSize: fontSize.caption,
    color: colors.iconStrong,
    textAlign: "center",
  },
});
