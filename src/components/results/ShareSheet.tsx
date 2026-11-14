// 결과 카드로 공유 (2026-11-14 데이터 허브 시안 ShareSheet)
// 공용 아래 창: [인사이트 카드 | 문항 카드] → 카드 미리보기 → (문항 카드면 문항 칩) → [이미지로 공유] [출처 복사]
// 이미지는 화면 밖에 큰 카드를 그려 두고 찍는다 (스토리 1080×1920 · 정사각 1080×1080). 폰 공유 창에서 인스타·카톡·사진 저장을 고른다
// 시안의 스토리 공유·이미지 저장·링크 복사 버튼은 테스트 후 검토 (새 부품·웹 공개 페이지 필요, docs/QUESTIONS.md)
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { SquareCard, StoryCard } from "@/components/results/ResultCards";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { copyCitation, shortPeriod } from "@/lib/citation";
import type { FullResults } from "@/lib/hub";
import { shareViewAsImage } from "@/lib/shareImage";
import { fetchRules } from "@/lib/rules";
import { buildSquareData, buildStoryData, squareQuestions } from "@/lib/shareCards";

type Kind = "story" | "square";

type Props = {
  full: FullResults;
  title: string;
  host: string;
  onClose: () => void;
};

// 이미지로 찍을 큰 카드의 화면 너비 (찍을 때 1080px로 맞춘다)
const CAPTURE_WIDTH = 360;

export default function ShareSheet({ full, title, host, onClose }: Props) {
  const [kind, setKind] = useState<Kind>("story");
  const [fewUnder, setFewUnder] = useState(10);
  const questions = squareQuestions(full);
  const [questionId, setQuestionId] = useState<number | null>(questions[0]?.q.id ?? null);
  const [sharing, setSharing] = useState(false);
  const captureRefView = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    fetchRules(["low_response_warning"]).then((r) => setFewUnder(r.low_response_warning ?? 10));
  }, []);

  const story = buildStoryData(full, fewUnder);
  const picked = questions.find((x) => x.q.id === questionId)?.q ?? questions[0]?.q;
  const square = picked ? buildSquareData(picked) : null;
  // 인사이트 카드를 만들 결과가 없으면 문항 카드만
  const current: Kind = kind === "story" && !story ? "square" : kind;
  const period = shortPeriod(full);

  const share = async () => {
    setSharing(true);
    await shareViewAsImage(captureRefView, current, title);
    setSharing(false);
  };

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title}>결과 카드로 공유</Text>
      {story && (
        <Segmented
          options={[
            { value: "story", label: "인사이트 카드" },
            { value: "square", label: "문항 카드" },
          ]}
          value={current}
          onChange={setKind}
        />
      )}

      {/* 미리보기 (실제 카드를 작게) */}
      <View style={styles.preview}>
        {current === "story" && story ? (
          <View style={styles.previewShadow}>
            <StoryCard width={172} total={full.total} period={period} data={story} />
          </View>
        ) : square ? (
          <View style={styles.previewShadow}>
            <SquareCard width={240} total={full.total} period={period} data={square} />
          </View>
        ) : (
          <Text style={styles.empty}>카드로 만들 수 있는 문항이 없어요.</Text>
        )}
      </View>

      {/* 문항 카드: 문항 고르기 */}
      {current === "square" && questions.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {questions.map(({ index, q }) => {
            const on = q.id === picked?.id;
            return (
              <Pressable key={q.id} onPress={() => setQuestionId(q.id)} style={[styles.chip, on && styles.chipOn]} hitSlop={4}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>Q{index + 1}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Text style={styles.hint}>
        {current === "story" ? "인스타 스토리에 딱 맞는 세로형이에요" : "카톡·피드에 올리기 좋은 정사각형이에요"} · 공유 창에서 사진
        저장도 할 수 있어요
      </Text>

      <View style={styles.actions}>
        <Button title="출처 복사" variant="outline" onPress={() => copyCitation(full, title, host)} style={styles.side} />
        <Button
          title="이미지로 공유"
          onPress={share}
          loading={sharing}
          disabled={!(current === "story" ? story : square)}
          style={styles.main}
        />
      </View>

      {/* 이미지로 찍을 큰 카드 (화면 밖) */}
      <View style={styles.offscreen} pointerEvents="none">
        {current === "story" && story ? (
          <StoryCard ref={captureRefView} width={CAPTURE_WIDTH} total={full.total} period={period} data={story} />
        ) : square ? (
          <SquareCard ref={captureRefView} width={CAPTURE_WIDTH} total={full.total} period={period} data={square} />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 18,
    marginBottom: 14,
    fontSize: fontSize.subtitle,
    fontWeight: "800",
    color: colors.text,
  },
  preview: {
    height: 330,
    marginTop: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
  },
  previewShadow: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  empty: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  chips: {
    gap: 6,
    paddingTop: 14,
  },
  chip: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  chipText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textStrong,
  },
  chipTextOn: {
    color: colors.primary,
  },
  hint: {
    marginTop: 10,
    textAlign: "center",
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  side: {
    flex: 1,
  },
  main: {
    flex: 2,
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: 0,
  },
});
