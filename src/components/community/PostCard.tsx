import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import CardFooter from "@/components/community/CardFooter";
import TugBar from "@/components/community/TugBar";
import LinkedText from "@/components/LinkedText";
import { listCardStyles } from "@/components/listCardStyles";
import { percent } from "@/components/results/QuestionResult";
import Badge from "@/components/ui/Badge";
import GrowBar from "@/components/ui/GrowBar";
import { Text } from "@/components/ui/Text";
import { uiIcons } from "@/constants/icons";
import CheckRow from "@/components/ui/CheckRow";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { KIND_LABELS, type PromoSurvey, type Post } from "@/lib/community";
import { contentImageUrl } from "@/lib/contentImage";
import { errorMessage } from "@/lib/errors";
import { formatAgo, formatPoints, formatTimeLeft } from "@/lib/format";
import { showNotice } from "@/lib/notice";
import { supabase } from "@/lib/supabase";

// 피드에서 골라 줘 보기는 3개까지 (나머지는 "보기 n개 더" → 상세)
const FEED_OPTION_MAX = 3;
// 골라 줘 막대가 위에서부터 차례로 차오르는 간격
const STAGGER_MS = 80;

type Props = {
  post: Post;
  // 투표가 끝나면 (목록·상세를 다시 불러오게)
  onVoted: () => void;
  // 카드 전체를 눌렀을 때 (목록에서는 상세로). 없으면 누를 수 없음
  onOpen?: () => void;
  // 상세 화면: 본문·보기를 줄이지 않고 다 보여 준다
  full?: boolean;
  // HOT 게시판에 든 글이면 🔥 HOT 뱃지 (2026-11-03)
  hot?: boolean;
};

// 커뮤니티 글 카드 (2026-11-14 커뮤니티 시안 ①): 종류별로
// 밸런스 = 줄다리기 막대 · 나만 그래? = 버튼 안이 비율만큼 채워짐 · 골라 줘 = 세로 보기 목록 · 설문 홍보 = 설문 미니 카드
// 일반 글 (2026-11-16) = 사진(피드는 첫 장 + n장 더, 상세는 모두) + 투표가 있으면 골라 줘 목록 (여러 개 고르기면 체크 후 [투표하기])
export default function PostCard({ post, onVoted, onOpen, full, hot }: Props) {
  const [sending, setSending] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);
  const justVoted = earned !== null;

  // 보낼 동안 다시 누르면 무시한다. 버튼을 잠그지(disabled) 않는 이유: 잠긴 버튼을 누르면 그 터치가 카드로 넘어가
  // 글 안으로 들어가 버림 (2026-11-14 나만 그래? 피드백)
  const vote = async (choice: number | number[]) => {
    if (sending) return;
    setSending(true);
    const { data, error } = Array.isArray(choice)
      ? await supabase.rpc("vote_post_multi", { p_post_id: post.id, p_choices: choice })
      : await supabase.rpc("vote_post", { p_post_id: post.id, p_choice: choice });
    setSending(false);
    if (error) {
      showNotice("투표하지 못했어요", errorMessage(error));
      onVoted();
      return;
    }
    setEarned((data as { reward: number }).reward);
    onVoted();
  };

  const counts = post.counts;
  const isTug = post.kind === "balance" && post.options.length === 2;
  const isRelate = post.kind === "relate" && post.options.length === 2;
  const isFree = post.kind === "free";
  const hasPoll = post.options.length > 0;
  const images = (post.images ?? []).map((path) => contentImageUrl(path)).filter((u): u is string => !!u);

  return (
    <Pressable style={[listCardStyles.card, styles.card]} onPress={onOpen} disabled={!onOpen}>
      {/* 머리: 종류 뱃지 · 작성자 · 시간 */}
      <View style={styles.head}>
        <Badge label={KIND_LABELS[post.kind]} tone={post.kind === "promo" ? "accent" : "primary"} />
        {hot && <Badge label="🔥 HOT" tone="hot" />}
        <Text style={styles.meta} numberOfLines={1}>
          {post.author}
          {post.mine ? " (나)" : ""} · {formatAgo(post.created_at)}
        </Text>
      </View>
      <Text style={[styles.question, full && styles.questionFull]} selectable={full}>
        {post.question}
      </Text>
      {/* 본문: 주소는 링크, 상세에서는 길게 눌러 복사. 피드의 홍보글은 한 줄만 */}
      {post.body ? (
        <LinkedText
          style={styles.body}
          numberOfLines={full ? undefined : post.kind === "promo" ? 1 : 3}
          selectable={full}
        >
          {post.body}
        </LinkedText>
      ) : null}

      {isFree && images.length > 0 && <Photos urls={images} full={full} />}

      {post.kind === "promo" && post.survey ? (
        <PromoMini survey={post.survey} mine={post.mine} />
      ) : isFree && !hasPoll ? null : isFree && post.poll_multi && !counts ? (
        <MultiPick post={post} onVote={vote} full={full} sending={sending} />
      ) : isTug ? (
        <TugBar
          labels={[post.options[0], post.options[1]]}
          counts={counts ? [counts[0] ?? 0, counts[1] ?? 0] : null}
          votes={post.votes}
          myChoice={post.my_choice}
          onVote={vote}
          // 상세: 크게 + 들어올 때 50%에서 실제 비율로 움직인다
          animate={justVoted || !!full}
          size={full ? "lg" : "md"}
        />
      ) : isRelate ? (
        <RelateButtons post={post} onVote={vote} />
      ) : (
        <PickList post={post} onVote={vote} full={full} justVoted={justVoted} />
      )}

      {post.mine && post.my_choice === null && counts && <Text style={styles.meta}>내 글이라 결과를 먼저 볼 수 있어요.</Text>}
      {earned !== null && earned > 0 && <Text style={styles.earned}>+{formatPoints(earned)} 받았어요</Text>}

      {/* 아래: 구분선 + 참여·댓글 수 (설문 홍보는 댓글만) */}
      <CardFooter
        votes={post.kind === "promo" || (isFree && !hasPoll) ? undefined : post.votes}
        comments={post.comment_count}
      />
    </Pressable>
  );
}

type VoteProps = { post: Post; onVote: (choice: number) => void };

// 일반 글 투표 머리말: 여러 개 고르기 · 마감까지 남은 시간 / 마감됨
function pollNote(post: Post): string | null {
  if (post.kind !== "free") return null;
  const parts: string[] = [];
  if (post.poll_multi) parts.push("여러 개 고를 수 있어요");
  if (post.poll_closes_at) {
    parts.push(new Date(post.poll_closes_at).getTime() <= Date.now() ? "투표 마감" : `${formatTimeLeft(post.poll_closes_at)} 남음`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// 일반 글 사진: 피드는 첫 장 + "+n", 상세는 모두 세로로
function Photos({ urls, full }: { urls: string[]; full?: boolean }) {
  if (full) {
    return (
      <View style={styles.photos}>
        {urls.map((u) => (
          <Image key={u} source={{ uri: u }} style={styles.photoFull} contentFit="cover" transition={150} />
        ))}
      </View>
    );
  }
  return (
    <View>
      <Image source={{ uri: urls[0] }} style={styles.photo} contentFit="cover" transition={150} />
      {urls.length > 1 && (
        <View style={styles.photoMore}>
          <Text style={styles.photoMoreText}>+{urls.length - 1}</Text>
        </View>
      )}
    </View>
  );
}

// 일반 글 여러 개 고르기 (투표 전): 체크 → [투표하기]
function MultiPick({
  post,
  onVote,
  full,
  sending,
}: {
  post: Post;
  onVote: (choices: number[]) => void;
  full?: boolean;
  sending: boolean;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const note = pollNote(post);
  const limit = full ? post.options.length : FEED_OPTION_MAX;
  const hidden = post.options.length - limit;
  // 피드에서는 보기가 다 안 보여서, 고르기는 상세에서
  if (!full) {
    return (
      <View style={styles.pickList}>
        {note && <Text style={styles.pollNote}>{note}</Text>}
        {post.options.slice(0, limit).map((label, i) => (
          <View key={i} style={styles.pick}>
            <Text style={styles.pickText} numberOfLines={2}>
              {label}
            </Text>
          </View>
        ))}
        <Text style={styles.more}>{hidden > 0 ? `보기 ${hidden}개 더 · ` : ""}눌러서 투표하기</Text>
      </View>
    );
  }
  const toggle = (i: number) => setPicked((all) => (all.includes(i) ? all.filter((x) => x !== i) : [...all, i]));
  return (
    <View style={styles.pickList}>
      {note && <Text style={styles.pollNote}>{note}</Text>}
      {post.options.map((label, i) => (
        <CheckRow key={i} label={label} checked={picked.includes(i)} onPress={() => toggle(i)} />
      ))}
      <Pressable
        onPress={() => picked.length > 0 && onVote(picked)}
        style={[styles.multiButton, (picked.length === 0 || sending) && styles.multiButtonOff]}
        accessibilityRole="button"
      >
        <Text style={styles.multiButtonText}>{picked.length > 0 ? `${picked.length}개 골라서 투표하기` : "보기를 골라 주세요"}</Text>
      </Pressable>
    </View>
  );
}

// 나만 그래?: 버튼 두 개. 누르면 버튼 안이 비율만큼 채워지고 퍼센트 표시 (내 선택 쪽 채움이 조금 진함)
function RelateButtons({ post, onVote }: VoteProps) {
  const counts = post.counts;
  const total = (counts ?? []).reduce((a, b) => a + b, 0);
  return (
    <View style={styles.relateRow}>
      {post.options.map((label, i) => {
        const base = i === 0 ? colors.primaryFaint : colors.surfaceMuted;
        if (!counts) {
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.relate, { backgroundColor: base }, pressed && styles.pressed]}
              onPress={() => onVote(i)}
            >
              <Text style={styles.relateText}>{label}</Text>
            </Pressable>
          );
        }
        const mine = post.my_choice === i;
        const pct = percent(counts[i] ?? 0, total);
        return (
          <View key={i} style={[styles.relate, { backgroundColor: base }, mine && styles.relateMine]}>
            {/* 채움은 여백 없는 바깥 틀 안에 (버튼 안쪽 여백 때문에 100%여도 끝까지 안 차던 문제) */}
            <View style={styles.fillBox}>
              <GrowBar pct={pct} style={[styles.fill, { backgroundColor: mine ? colors.primaryLight : colors.border }]} />
            </View>
            <Text style={[styles.relateText, mine && styles.mineText]}>
              {label} {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// 골라 줘: 세로 보기 목록. 누르면 위에서부터 차례로 막대가 차오르고, 가장 많이 고른 보기에 "1위" (순서는 그대로)
function PickList({ post, onVote, full, justVoted }: VoteProps & { full?: boolean; justVoted: boolean }) {
  const reduce = useReducedMotion();
  const counts = post.counts;
  // 여러 개 고르기는 "투표한 사람 중 몇 %"가 고른 보기인지
  const total = post.poll_multi ? post.votes : (counts ?? []).reduce((a, b) => a + b, 0);
  const top = counts ? Math.max(...counts) : 0;
  const limit = full ? post.options.length : FEED_OPTION_MAX;
  const hidden = post.options.length - limit;
  const note = pollNote(post);
  const mineOf = (i: number) => (post.my_choices ? post.my_choices.includes(i) : post.my_choice === i);

  return (
    <View style={styles.pickList}>
      {note && <Text style={styles.pollNote}>{note}</Text>}
      {post.options.slice(0, limit).map((label, i) => {
        if (!counts) {
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [styles.pick, pressed && styles.pickPressed]}
              onPress={() => onVote(i)}
            >
              <Text style={styles.pickText} numberOfLines={2}>
                {label}
              </Text>
            </Pressable>
          );
        }
        const mine = mineOf(i);
        const count = counts[i] ?? 0;
        const pct = percent(count, total);
        return (
          <View key={i} style={[styles.pick, mine && styles.pickMine]}>
            <View style={styles.fillBox}>
              <GrowBar
                pct={pct}
                delay={i * STAGGER_MS}
                style={[styles.fill, { backgroundColor: mine ? colors.primaryLight : colors.surfaceMuted }]}
              />
            </View>
            {mine && (
              <Animated.View entering={justVoted && !reduce ? ZoomIn.duration(250) : undefined}>
                <AppIcon name={uiIcons.check} size={16} color={colors.primary} />
              </Animated.View>
            )}
            <Text style={[styles.pickText, styles.pickLabel, mine && styles.mineText]} numberOfLines={2}>
              {label}
            </Text>
            {count > 0 && count === top && <Badge label="1위" tone="accent" size="sm" />}
            <Text style={[styles.pickPct, mine && styles.mineText]}>{pct}%</Text>
          </View>
        );
      })}
      {hidden > 0 && <Text style={styles.more}>보기 {hidden}개 더</Text>}
    </View>
  );
}

// 설문 홍보: 설문 미니 카드 (제목 · n문항 · 약 n분 · 포인트). 누르면 설문으로
function PromoMini({ survey, mine }: { survey: PromoSurvey; mine: boolean }) {
  const open = () => router.push({ pathname: "/survey/[id]", params: { id: String(survey.id) } });
  const status = mine ? "내 설문 보기" : survey.answered ? "이미 응답했어요" : survey.open ? "응답하러 가기" : "마감된 설문이에요";
  const active = mine || (survey.open && !survey.answered);
  return (
    <Pressable style={({ pressed }) => [styles.promo, pressed && styles.pressed]} onPress={open}>
      <Text style={styles.promoTitle} numberOfLines={2}>
        {survey.title}
      </Text>
      <View style={styles.promoRow}>
        <Text style={styles.promoMeta} numberOfLines={1}>
          {survey.questions}문항 · 약 {survey.minutes}분 · 남은 자리 {survey.remaining}명
          {survey.closes_at ? ` · ${formatTimeLeft(survey.closes_at)}` : ""}
        </Text>
        {survey.reward > 0 && <Badge label={`+${formatPoints(survey.reward)}`} tone="peach" size="sm" />}
      </View>
      <View style={styles.promoFoot}>
        <Text style={[styles.promoStatus, active && styles.promoStatusOn]}>{status}</Text>
        {active && <AppIcon name={uiIcons.chevron} size={12} color={colors.primary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 모양은 설문·데이터 탭 목록 카드와 같게 (listCardStyles, 2026-11-14 통일). 안쪽 간격만 넓게
  card: {
    gap: 12,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  meta: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  question: {
    fontSize: fontSize.body,
    lineHeight: 23,
    fontWeight: "800",
    color: colors.text,
  },
  // 상세 화면 제목은 크게
  questionFull: {
    fontSize: fontSize.title,
    lineHeight: 30,
  },
  body: {
    fontSize: fontSize.label,
    lineHeight: 21,
    color: colors.textStrong,
  },
  earned: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  mineText: {
    color: colors.primaryDeep,
    fontWeight: "800",
  },
  // 나만 그래?
  relateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  relate: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
  },
  relateMine: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  // 결과 채움 막대의 틀: 버튼 테두리 안쪽 전체
  fillBox: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  fill: {
    height: "100%",
  },
  relateText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  // 골라 줘
  pickList: {
    gap: spacing.sm,
  },
  pick: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pickPressed: {
    borderColor: colors.primary,
  },
  pickMine: {
    borderColor: colors.primary,
  },
  pickText: {
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.text,
  },
  pickLabel: {
    flex: 1,
  },
  pickPct: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  pollNote: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
  },
  multiButton: {
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  multiButtonOff: {
    backgroundColor: colors.disabled,
  },
  multiButtonText: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  // 일반 글 사진
  photo: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
  },
  photoMore: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.overlayStrong,
  },
  photoMoreText: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  photos: {
    gap: spacing.sm,
  },
  photoFull: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
  },
  more: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  // 설문 홍보 미니 카드
  promo: {
    padding: 14,
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
  },
  promoTitle: {
    fontSize: fontSize.body,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.cardTitle,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  promoMeta: {
    flexShrink: 1,
    fontSize: fontSize.caption,
    color: colors.cardSub,
  },
  promoFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  promoStatus: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.textMuted,
  },
  promoStatusOn: {
    color: colors.primary,
  },
});
