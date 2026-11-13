// 결과 카드 이미지 2종 (2026-11-14 데이터 허브 시안 CardStory · CardSquare)
// - StoryCard: 인사이트 카드, 스토리 9:16 (파란 바탕 · 큰 문장 · 근거 차트 · 캐릭터)
// - SquareCard: 문항 카드, 정사각 1:1 (연파랑 바탕 · 문항 · 보기 막대 · 캐릭터)
// 시안은 540px 기준. width를 주면 모든 크기를 같은 비율로 맞춘다 → 공유 시트 미리보기(작게)와 저장용(크게)을 같은 부품으로 그린다
// 응답 수 · 조사 기간 · 출처(옛썰 데이터 허브)를 늘 넣는다
import { Image } from "expo-image";
import type { ComponentRef, Ref } from "react";
import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/constants/theme";
import type { SquareData, StoryData } from "@/lib/shareCards";

const CHEER = require("../../../assets/images/characters/cheer.png");
// 캐릭터 그림 비율 (410 × 305)
const CHEER_RATIO = 305 / 410;
const BASE = 540;

type Common = {
  ref?: Ref<ComponentRef<typeof View>>;
  width: number;
  total: number;
  // "10.16~10.23"
  period: string;
};

// 1위만 파랑, 나머지 연한 파랑 (Blue 200)
function barColor(top: boolean) {
  return top ? colors.primary : colors.onPrimaryMuted;
}

export function StoryCard({ ref, width, total, period, data }: Common & { data: StoryData }) {
  const k = width / BASE;
  const height = (width * 16) / 9;
  const max = Math.max(...data.rows.map((r) => r.value));
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width,
        height,
        overflow: "hidden",
        backgroundColor: colors.primary,
        paddingTop: 56 * k,
        paddingHorizontal: 44 * k,
        paddingBottom: 44 * k,
      }}
    >
      {/* 장식 원 2개 */}
      <View
        style={{
          position: "absolute",
          right: -120 * k,
          top: -120 * k,
          width: 360 * k,
          height: 360 * k,
          borderRadius: 180 * k,
          backgroundColor: colors.primaryStrong,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: -90 * k,
          bottom: 120 * k,
          width: 240 * k,
          height: 240 * k,
          borderRadius: 120 * k,
          backgroundColor: colors.primaryDeco,
          opacity: 0.35,
        }}
      />

      {/* 위: 옛썰 + 대학생 데이터 / 응답 n명 */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * k }}>
          <Text style={{ fontSize: 30 * k, fontWeight: "800", color: colors.onPrimary }}>옛썰</Text>
          <View
            style={{
              paddingVertical: 5 * k,
              paddingHorizontal: 11 * k,
              borderRadius: 999,
              backgroundColor: colors.accent,
            }}
          >
            <Text style={{ fontSize: 14 * k, fontWeight: "800", color: colors.onAccent }}>대학생 데이터</Text>
          </View>
        </View>
        <Text style={{ fontSize: 16 * k, color: colors.primarySoft }}>응답 {total}명</Text>
      </View>

      {/* 문항 → 큰 문장 (숫자 하나만 라임) */}
      <Text style={{ marginTop: 56 * k, fontSize: 18 * k, color: colors.onPrimaryMuted }} numberOfLines={2}>
        Q. {data.question}
      </Text>
      <Text
        style={{ marginTop: 14 * k, fontSize: 44 * k, lineHeight: 56 * k, fontWeight: "800", color: colors.onPrimary }}
        numberOfLines={4}
      >
        {data.headline.before}
        <Text style={{ color: colors.accent }}>{data.headline.strong}</Text>
        {data.headline.after}
      </Text>

      {/* 흰 카드: 근거 차트 */}
      <View
        style={{
          marginTop: 36 * k,
          paddingTop: 28 * k,
          paddingHorizontal: 28 * k,
          paddingBottom: 24 * k,
          borderRadius: 28 * k,
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 * k }}>
          <Text style={{ flexShrink: 1, fontSize: 18 * k, fontWeight: "800", color: colors.text }} numberOfLines={1}>
            {data.chartTitle}
          </Text>
          <Text style={{ fontSize: 15 * k, color: colors.iconStrong }}>{data.chartSub}</Text>
        </View>
        <View style={{ marginTop: 20 * k, gap: 14 * k }}>
          {data.rows.map((r) => {
            const top = r.value === max;
            const pct = data.unit === "점" ? (r.value / 5) * 100 : r.value;
            return (
              <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 14 * k }}>
                <Text
                  style={{ width: 72 * k, fontSize: 16 * k, fontWeight: top ? "800" : "500", color: colors.text }}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
                <View style={{ flex: 1, height: 22 * k, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: "hidden" }}>
                  <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: barColor(top) }} />
                </View>
                <Text
                  style={{
                    width: 60 * k,
                    textAlign: "right",
                    fontSize: 18 * k,
                    fontWeight: top ? "800" : "500",
                    color: top ? colors.primary : colors.iconStrong,
                  }}
                >
                  {r.value}
                  {data.unit}
                </Text>
              </View>
            );
          })}
        </View>
        {data.overall !== null && (
          <View
            style={{
              marginTop: 16 * k,
              paddingTop: 12 * k,
              borderTopWidth: 2 * k,
              borderTopColor: colors.border,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 15 * k, color: colors.iconStrong }}>전체 평균</Text>
            <Text style={{ fontSize: 15 * k, fontWeight: "800", color: colors.text }}>
              {data.overall}
              {data.unit}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }} />

      {/* 아래: 캐릭터 + 너는 어때? */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 16 * k }}>
        <Image source={CHEER} style={{ width: 130 * k, height: 130 * k * CHEER_RATIO }} contentFit="contain" />
        <View style={{ flex: 1, paddingBottom: 8 * k }}>
          <Text style={{ fontSize: 22 * k, lineHeight: 30 * k, fontWeight: "800", color: colors.onPrimary }}>
            너는 어때?{"\n"}옛썰에서 답하고 결과 보기
          </Text>
          <Text style={{ marginTop: 8 * k, fontSize: 14 * k, color: colors.onPrimaryMuted }}>
            옛썰 데이터 허브 · {period} 조사
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SquareCard({ ref, width, total, period, data }: Common & { data: SquareData }) {
  const k = width / BASE;
  const max = Math.max(...data.rows.map((r) => r.value));
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width,
        height: width,
        overflow: "hidden",
        backgroundColor: colors.primaryFaint,
        paddingTop: 40 * k,
        paddingHorizontal: 40 * k,
        paddingBottom: 32 * k,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ paddingVertical: 6 * k, paddingHorizontal: 12 * k, borderRadius: 999, backgroundColor: colors.primary }}>
          <Text style={{ fontSize: 14 * k, fontWeight: "800", color: colors.onPrimary }}>대학생 {total}명에게 물었어요</Text>
        </View>
        <Text style={{ fontSize: 22 * k, fontWeight: "800", color: colors.primary }}>옛썰</Text>
      </View>

      <Text
        style={{ marginTop: 24 * k, fontSize: 28 * k, lineHeight: 37 * k, fontWeight: "800", color: colors.text }}
        numberOfLines={3}
      >
        {data.question}
      </Text>

      <View style={{ marginTop: 22 * k, gap: 13 * k }}>
        {data.rows.map((r) => {
          const top = r.value === max;
          return (
            <View key={r.label} style={{ gap: 6 * k }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 * k }}>
                <Text
                  style={{ flexShrink: 1, fontSize: 17 * k, fontWeight: top ? "800" : "500", color: colors.text }}
                  numberOfLines={1}
                >
                  {r.label}
                </Text>
                <Text style={{ fontSize: (top ? 24 : 18) * k, fontWeight: "800", color: top ? colors.primary : colors.iconStrong }}>
                  {r.value}%
                </Text>
              </View>
              <View style={{ height: 16 * k, borderRadius: 999, backgroundColor: colors.surface, overflow: "hidden" }}>
                <View style={{ width: `${r.value}%`, height: "100%", borderRadius: 999, backgroundColor: barColor(top) }} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13 * k, lineHeight: 20 * k, color: colors.iconStrong }}>
          옛썰 데이터 허브{"\n"}
          {period} · 대학생 {total}명 응답
        </Text>
        <Image
          source={CHEER}
          style={{ width: 96 * k, height: 96 * k * CHEER_RATIO, marginBottom: -6 * k }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}
