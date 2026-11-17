// ys-142 글 만들기 · F-603 (밸런스 · 나만 그래? · 골라 줘 · 일반 글 · 설문 홍보)
// 2026-11-14 커뮤니티 시안 ③: 종류 칩 + 힌트 · 질문 40자 · 밸런스 보기는 연파랑/연연두 칸 + VS (12자) ·
// 나만 그래?는 보기 자동 · 골라 줘 3칸에서 시작해 최대 5개 · 설문 홍보는 내 설문 카드에서 고르기
// 2026-11-16 일반 글: 제목 + 본문(꼭) + 사진 3장 + 투표(선택: 보기 2~10 · 여러 개 고르기 · 마감)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import AppIcon from "@/components/AppIcon";
import AnonToggle from "@/components/community/AnonToggle";
import Chips from "@/components/create/Chips";
import { formStyles } from "@/components/create/formStyles";
import LabelRow from "@/components/create/LabelRow";
import PrimaryButton from "@/components/PrimaryButton";
import CheckRow from "@/components/ui/CheckRow";
import { Text, TextInput } from "@/components/ui/Text";
import { feedbackIcons } from "@/constants/icons";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import {
  fetchCanAnonymous,
  FREE_BODY_MAX,
  FREE_IMAGE_MAX,
  FREE_POLL_DAYS,
  FREE_POLL_MAX,
  FREE_POLL_MIN,
  KIND_HINTS,
  KIND_LABELS,
  POST_BODY_MAX,
  type PostKind,
} from "@/lib/community";
import { type PickedImage, pickContentImage, uploadContentImage } from "@/lib/contentImage";
import { errorMessage } from "@/lib/errors";
import { canPickImage } from "@/lib/nativeFeatures";
import { fetchRules } from "@/lib/rules";
import { supabase } from "@/lib/supabase";

// 화면에서 받는 글자 수 (서버 create_post는 질문 100자 · 보기 30자까지 받는다. 화면은 시안대로 더 짧게)
const QUESTION_MAX = 40;
// 일반 글 제목 (서버는 100자)
const FREE_TITLE_MAX = 50;
const BALANCE_OPTION_MAX = 12;
const PICK_OPTION_MAX = 30;
// 골라 줘 보기 수: 처음 3칸, 2~5개 (서버와 같음)
const PICK_START = 3;
const PICK_MIN = 2;
const PICK_MAX = 5;
// 나만 그래? 보기 (서버가 정한다. 화면엔 미리 보기로만)
const RELATE_OPTIONS = ["나도 그래", "나는 아냐"];

const KINDS = (Object.keys(KIND_LABELS) as PostKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }));

type PromoChoice = { id: number; title: string };

export default function NewPost() {
  // ?promo=설문번호 로 들어오면 그 설문 홍보글로 시작 (등록 완료 화면에서, 2026-11-14)
  const { promo } = useLocalSearchParams<{ promo?: string }>();
  const [kind, setKind] = useState<PostKind>(promo ? "promo" : "balance");
  const [question, setQuestion] = useState("");
  const [body, setBody] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 하루 최대 글 수 (안내 문구용, point_rules)
  const [dailyMax, setDailyMax] = useState<number | null>(null);
  // 설문 홍보: 홍보할 수 있는 내 설문 (진행 중, 아직 홍보 안 함)
  const [mySurveys, setMySurveys] = useState<PromoChoice[]>([]);
  const [surveyId, setSurveyId] = useState<number | null>(null);
  // 익명으로 올리기 (학생만 체크가 보인다. 기본 켜짐, 2026-11-03)
  const [anonymous, setAnonymous] = useState(true);
  const [canAnon, setCanAnon] = useState(false);
  // 일반 글: 사진(올리기 전 폰에 있는 것) · 투표
  const [images, setImages] = useState<PickedImage[]>([]);
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMulti, setPollMulti] = useState(false);
  const [pollDays, setPollDays] = useState<number | null>(null);

  useEffect(() => {
    fetchCanAnonymous().then(setCanAnon);
    fetchRules(["post_daily_max"]).then((r) => setDailyMax(r.post_daily_max ?? null));
    supabase.rpc("get_promotable_surveys").then(({ data }) => {
      const list = (data as PromoChoice[] | null) ?? [];
      setMySurveys(list);
      const wanted = list.find((s) => String(s.id) === promo);
      setSurveyId(wanted?.id ?? list[0]?.id ?? null);
    });
  }, [promo]);

  const isPromo = kind === "promo";
  const isFree = kind === "free";
  const needsOptions = kind === "balance" || kind === "pick";
  const filled = options.map((o) => o.trim());
  const optionsOk = !needsOptions || (filled.every((o) => o.length > 0) && new Set(filled).size === filled.length);
  const pollFilled = pollOptions.map((o) => o.trim());
  const pollOk =
    !isFree || !pollOn || (pollFilled.every((o) => o.length > 0) && new Set(pollFilled).size === pollFilled.length);
  const canSend =
    question.trim().length > 0 &&
    optionsOk &&
    pollOk &&
    (!isFree || body.trim().length > 0) &&
    (!isPromo || surveyId !== null);
  const titleMax = isFree ? FREE_TITLE_MAX : QUESTION_MAX;
  const bodyMax = isFree ? FREE_BODY_MAX : POST_BODY_MAX;

  const addImage = async () => {
    const picked = await pickContentImage(false);
    if (picked) setImages((all) => [...all, picked].slice(0, FREE_IMAGE_MAX));
  };

  const changeKind = (k: PostKind) => {
    setKind(k);
    // 밸런스는 보기 2개 고정, 골라 줘는 3칸에서 시작
    if (k === "balance") setOptions((o) => [o[0] ?? "", o[1] ?? ""].map((v) => v.slice(0, BALANCE_OPTION_MAX)));
    if (k === "pick") setOptions((o) => (o.length >= PICK_START ? o : [...o, ...Array(PICK_START - o.length).fill("")]));
  };

  const setOption = (i: number, text: string) => setOptions((o) => o.map((v, j) => (j === i ? text : v)));

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    // 일반 글 사진은 올리기를 누를 때 저장소에 올린다 (posts/<내 id>/)
    let imagePaths: string[] = [];
    if (isFree && images.length > 0) {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("not_authenticated");
        imagePaths = await Promise.all(images.map((img) => uploadContentImage(`posts/${uid}`, img)));
      } catch (e) {
        setSending(false);
        setError(errorMessage(e as Error));
        return;
      }
    }
    const { data, error: sendError } = isPromo
      ? await supabase.rpc("create_promo", {
          p_survey_id: surveyId as number,
          p_question: question.trim(),
          p_body: body.trim() || undefined,
        })
      : await supabase.rpc("create_post", {
          p_kind: kind,
          p_question: question.trim(),
          p_options: needsOptions ? filled : isFree && pollOn ? pollFilled : undefined,
          p_body: body.trim() || undefined,
          p_anonymous: anonymous,
          p_images: isFree && imagePaths.length > 0 ? imagePaths : undefined,
          p_poll_multi: isFree && pollOn ? pollMulti : undefined,
          p_poll_days: isFree && pollOn && pollDays !== null ? pollDays : undefined,
        });
    setSending(false);
    if (sendError) {
      setError(errorMessage(sendError));
      return;
    }
    // 만든 글로 바로 이동 (뒤로 가기로 만들기 화면에 돌아오지 않게)
    router.replace({ pathname: "/community/[id]", params: { id: String(data) } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "글 만들기" }} />

      <View style={styles.field}>
        <Text style={styles.label}>종류</Text>
        <Chips options={KINDS} selected={kind} onSelect={changeKind} />
        <Text style={formStyles.hint}>{KIND_HINTS[kind]}</Text>
      </View>

      {/* 설문 홍보: 홍보할 내 설문 카드 */}
      {isPromo && (
        <Animated.View key="promo" entering={FadeIn.duration(200)} style={styles.field}>
          <Text style={styles.label}>홍보할 내 설문</Text>
          {mySurveys.length === 0 ? (
            <Text style={formStyles.hint}>홍보할 수 있는 진행 중인 설문이 없어요. 설문을 먼저 올리거나, 이미 홍보한 설문은 다시 올릴 수 없어요.</Text>
          ) : (
            mySurveys.map((s) => {
              const on = s.id === surveyId;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.surveyCard, on && styles.surveyCardOn]}
                  onPress={() => setSurveyId(s.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.surveyTitle, on && styles.surveyTitleOn]} numberOfLines={2}>
                    {s.title}
                  </Text>
                  {on && <Text style={styles.surveyPicked}>선택됨</Text>}
                </Pressable>
              );
            })
          )}
        </Animated.View>
      )}

      <View style={styles.field}>
        <LabelRow label={isPromo ? "한 줄 소개" : isFree ? "제목" : "질문"} length={question.length} max={titleMax} />
        <TextInput
          style={[formStyles.input, styles.box]}
          value={question}
          onChangeText={setQuestion}
          placeholder={
            isPromo
              ? "예: 3분이면 끝나요! 학식 개선에 쓸게요"
              : kind === "relate"
                ? "나만 그런지 궁금한 상황을 적어 주세요"
                : isFree
                  ? "제목을 적어 주세요"
                  : "무엇을 물어볼까요?"
          }
          maxLength={titleMax}
        />
      </View>

      {/* 보기: 종류마다 다른 모양 (바꾸면 살짝 나타남) */}
      {kind === "balance" && (
        <Animated.View key="balance" entering={FadeIn.duration(200)} style={styles.field}>
          <Text style={styles.label}>보기</Text>
          <View style={styles.balanceWrap}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.side, i === 0 ? styles.sideA : styles.sideB]}>
                <TextInput
                  style={[styles.sideInput, { color: i === 0 ? colors.primaryDeep : colors.onAccentSoft }]}
                  value={options[i] ?? ""}
                  onChangeText={(t) => setOption(i, t)}
                  placeholder={i === 0 ? "첫 번째 편 (예: 짜장)" : "두 번째 편 (예: 짬뽕)"}
                  placeholderTextColor={colors.textSubtle}
                  maxLength={BALANCE_OPTION_MAX}
                  accessibilityLabel={i === 0 ? "첫 번째 편" : "두 번째 편"}
                />
                <Text style={styles.sideCount}>
                  {(options[i] ?? "").length}/{BALANCE_OPTION_MAX}
                </Text>
              </View>
            ))}
            {/* 두 칸 사이 오른쪽에 걸친 VS */}
            <View style={styles.vs} pointerEvents="none">
              <Text style={styles.vsText}>VS</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {kind === "relate" && (
        <Animated.View key="relate" entering={FadeIn.duration(200)} style={styles.field}>
          <View style={styles.relateRow}>
            {RELATE_OPTIONS.map((label, i) => (
              <View key={label} style={[styles.relate, i === 0 ? styles.relateA : styles.relateB]}>
                <Text style={[styles.relateText, i === 0 && styles.relateTextA]}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={formStyles.hint}>보기는 자동으로 정해져요. 질문만 쓰면 돼요.</Text>
        </Animated.View>
      )}

      {kind === "pick" && (
        <Animated.View key="pick" entering={FadeIn.duration(200)} style={styles.field}>
          <Text style={styles.label}>보기</Text>
          {options.map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <TextInput
                style={[formStyles.input, styles.box, styles.optionInput]}
                value={o}
                onChangeText={(t) => setOption(i, t)}
                placeholder={`보기 ${i + 1}`}
                maxLength={PICK_OPTION_MAX}
              />
              {options.length > PICK_MIN && (
                <Pressable onPress={() => setOptions((all) => all.filter((_, j) => j !== i))} hitSlop={8}>
                  <Text style={styles.remove}>삭제</Text>
                </Pressable>
              )}
            </View>
          ))}
          {options.length < PICK_MAX && (
            <Pressable onPress={() => setOptions((all) => [...all, ""])} hitSlop={6}>
              <Text style={styles.add}>+ 보기 추가 (최대 {PICK_MAX}개)</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
      {needsOptions && !optionsOk && filled.every((x) => x.length > 0) && (
        <Text style={formStyles.error}>보기가 서로 달라야 해요.</Text>
      )}

      <View style={styles.field}>
        <LabelRow label="내용" optional={!isFree} length={body.length} max={bodyMax} />
        <TextInput
          style={[formStyles.input, formStyles.multiline, styles.box, isFree && styles.freeBody]}
          value={body}
          onChangeText={setBody}
          placeholder={isFree ? "하고 싶은 이야기를 자유롭게 적어 주세요" : "상황이나 이유를 덧붙여 주세요"}
          maxLength={bodyMax}
          multiline
        />
      </View>

      {/* 일반 글: 사진 3장 */}
      {isFree && canPickImage && (
        <Animated.View key="free-images" entering={FadeIn.duration(200)} style={styles.field}>
          <Text style={styles.label}>
            사진 <Text style={styles.labelSub}>(선택, 최대 {FREE_IMAGE_MAX}장)</Text>
          </Text>
          <View style={styles.thumbs}>
            {images.map((img, i) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  onPress={() => setImages((all) => all.filter((_, j) => j !== i))}
                  style={styles.thumbRemove}
                  hitSlop={6}
                  accessibilityLabel="사진 빼기"
                >
                  <AppIcon name={feedbackIcons.remove} size={14} color={colors.onPrimary} />
                </Pressable>
              </View>
            ))}
            {images.length < FREE_IMAGE_MAX && (
              <Pressable onPress={addImage} style={styles.thumbAdd} accessibilityLabel="사진 추가">
                <AppIcon name={feedbackIcons.image} size={22} color={colors.iconStrong} />
                <Text style={styles.thumbAddText}>
                  {images.length}/{FREE_IMAGE_MAX}
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={formStyles.hint}>얼굴·학생증 등 개인정보가 담긴 사진이나 남의 사진은 올리지 마세요.</Text>
        </Animated.View>
      )}

      {/* 일반 글: 투표 (선택) */}
      {isFree && (
        <Animated.View key="free-poll" entering={FadeIn.duration(200)} style={styles.field}>
          <CheckRow label="투표 추가하기" checked={pollOn} onPress={() => setPollOn((v) => !v)} />
          {pollOn && (
            <>
              {pollOptions.map((o, i) => (
                <View key={i} style={styles.optionRow}>
                  <TextInput
                    style={[formStyles.input, styles.box, styles.optionInput]}
                    value={o}
                    onChangeText={(t) => setPollOptions((all) => all.map((v, j) => (j === i ? t : v)))}
                    placeholder={`보기 ${i + 1}`}
                    maxLength={PICK_OPTION_MAX}
                  />
                  {pollOptions.length > FREE_POLL_MIN && (
                    <Pressable onPress={() => setPollOptions((all) => all.filter((_, j) => j !== i))} hitSlop={8}>
                      <Text style={styles.remove}>삭제</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              {pollOptions.length < FREE_POLL_MAX && (
                <Pressable onPress={() => setPollOptions((all) => [...all, ""])} hitSlop={6}>
                  <Text style={styles.add}>+ 보기 추가 (최대 {FREE_POLL_MAX}개)</Text>
                </Pressable>
              )}
              {!pollOk && pollFilled.every((x) => x.length > 0) && (
                <Text style={formStyles.error}>보기가 서로 달라야 해요.</Text>
              )}
              <CheckRow label="여러 개 고를 수 있게" checked={pollMulti} onPress={() => setPollMulti((v) => !v)} />
              <Text style={styles.label}>투표 마감</Text>
              <Chips
                options={FREE_POLL_DAYS.map((d) => ({
                  value: d === null ? "none" : String(d),
                  label: d === null ? "없음" : `${d}일`,
                }))}
                selected={pollDays === null ? "none" : String(pollDays)}
                onSelect={(v) => setPollDays(v === "none" ? null : Number(v))}
              />
            </>
          )}
        </Animated.View>
      )}

      <Text style={formStyles.hint}>
        욕설·혐오, 개인정보를 묻는 글은 신고되면 숨겨지고 삭제될 수 있어요.
        {dailyMax !== null ? ` 하루에 ${dailyMax}개까지 만들 수 있어요.` : ""}
      </Text>

      {canAnon && !isPromo && (
        <View style={styles.anonRow}>
          <AnonToggle value={anonymous} onChange={setAnonymous} />
          <Text style={formStyles.hint}>{anonymous ? "익명으로 올려요" : "닉네임이 보여요"}</Text>
        </View>
      )}

      {error !== "" && <Text style={formStyles.error}>{error}</Text>}

      <PrimaryButton title="올리기" onPress={send} disabled={!canSend} loading={sending} />
    </ScrollView>
  );
}

const VS_SIZE = 28;
const THUMB = 84;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: 20,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: "700",
    color: colors.iconStrong,
  },
  // 입력칸: 흰 상자 (시안: 밑줄형 X)
  box: {
    backgroundColor: colors.onPrimary,
  },
  // 밸런스 보기 두 칸
  balanceWrap: {
    gap: spacing.sm,
  },
  side: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: 14,
    // 오른쪽 VS 자리를 비운다
    paddingRight: 14 + VS_SIZE + 8,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  sideA: {
    backgroundColor: colors.primaryFaint,
    borderColor: colors.primaryLight,
  },
  sideB: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  sideInput: {
    flex: 1,
    paddingVertical: 0,
    // 입력칸 기본 바탕(흰색)을 지워 칸 색이 그대로 보이게
    backgroundColor: "transparent",
    fontSize: fontSize.body,
    fontWeight: "700",
  },
  sideCount: {
    fontSize: 11,
    color: colors.textSubtle,
  },
  vs: {
    position: "absolute",
    right: 20,
    top: 56 + spacing.sm / 2 - VS_SIZE / 2,
    width: VS_SIZE,
    height: VS_SIZE,
    borderRadius: VS_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.onPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vsText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.iconStrong,
  },
  // 나만 그래? 보기 미리 보기
  relateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  relate: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  relateA: {
    backgroundColor: colors.primaryFaint,
  },
  relateB: {
    backgroundColor: colors.surfaceMuted,
  },
  relateText: {
    fontSize: fontSize.body,
    fontWeight: "700",
    color: colors.textStrong,
  },
  relateTextA: {
    color: colors.primaryStrong,
  },
  // 골라 줘
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionInput: {
    flex: 1,
  },
  remove: {
    fontSize: fontSize.small,
    color: colors.danger,
  },
  add: {
    fontSize: fontSize.label,
    color: colors.primary,
    fontWeight: "700",
  },
  // 설문 홍보: 내 설문 카드
  surveyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.onPrimary,
  },
  surveyCardOn: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  surveyTitle: {
    flex: 1,
    fontSize: fontSize.label,
    fontWeight: "600",
    color: colors.text,
  },
  surveyTitleOn: {
    fontWeight: "700",
  },
  surveyPicked: {
    fontSize: fontSize.small,
    fontWeight: "700",
    color: colors.primary,
  },
  labelSub: {
    fontWeight: "400",
    color: colors.textMuted,
  },
  freeBody: {
    minHeight: 160,
  },
  thumbs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
  },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlayStrong,
  },
  thumbAdd: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.onPrimary,
  },
  thumbAddText: {
    fontSize: fontSize.small,
    color: colors.textMuted,
  },
  anonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
