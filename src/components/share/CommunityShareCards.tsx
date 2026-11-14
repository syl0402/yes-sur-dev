// 커뮤니티 결과 공유 이미지 틀 3개 (2026-11-14 share-cards 시안)
// - ShareBalance (정사각): 밸런스 · 나만 그래? · 오늘의 질문 — 줄다리기 막대 + "나는 ○○파" + 우리 편 형세
// - SharePick (정사각): 골라 줘 — 보기 막대(순서 그대로) + 1위 · 내 선택 칩
// - ShareWorldcup (스토리 9:16): 월드컵 — 나의 우승 + 모두의 순위 1~3위
// 시안은 540px 기준. width를 주면 모든 크기를 같은 비율로 맞춘다 (화면 밖에 그려 1080px로 찍는다)
// 이름·학교·닉네임은 넣지 않는다 (질문 · 비율 · 참여 수 · 내가 고른 것만)
import { Image } from "expo-image";
import type { ComponentRef, ReactNode, Ref } from "react";
import { View } from "react-native";

import AppIcon from "@/components/AppIcon";
import { Text } from "@/components/ui/Text";
import { worldcupIcons } from "@/constants/icons";
import { colors } from "@/constants/theme";

const CHEER = require("../../../assets/images/characters/cheer.png");
// 캐릭터 그림 비율 (410 × 305)
const CHEER_RATIO = 305 / 410;
const BASE = 540;
// 파란 바탕 위 반투명 흰색
const WHITE_14 = "rgba(255, 255, 255, 0.14)";
const WHITE_18 = "rgba(255, 255, 255, 0.18)";

type ViewRef = Ref<ComponentRef<typeof View>>;

// 공통 바탕: 파랑 + 장식 원 + 맨 아래 "옛썰" 한 줄 문구 + 캐릭터
function Frame({
  ref,
  width,
  story,
  tagline,
  cheerSize,
  children,
}: {
  ref?: ViewRef;
  width: number;
  story?: boolean;
  tagline: string;
  cheerSize: number;
  children: ReactNode;
}) {
  const k = width / BASE;
  const height = story ? (width * 16) / 9 : width;
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width,
        height,
        backgroundColor: colors.primary,
        overflow: "hidden",
        paddingTop: (story ? 64 : 36) * k,
        paddingHorizontal: (story ? 40 : 36) * k,
        paddingBottom: (story ? 48 : 36) * k,
      }}
    >
      <View
        style={{
          position: "absolute",
          ...(story
            ? { left: -120 * k, top: 260 * k }
            : { right: -80 * k, top: -90 * k }),
          width: (story ? 380 : 260) * k,
          height: (story ? 380 : 260) * k,
          borderRadius: 999,
          backgroundColor: colors.primaryDeco,
          opacity: story ? 0.35 : 0.45,
        }}
      />
      {children}
      <View
        style={{
          marginTop: "auto",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text
            style={{
              fontSize: (story ? 30 : 26) * k,
              fontWeight: "800",
              color: colors.onPrimary,
            }}
          >
            옛썰
          </Text>
          <Text
            style={{
              marginTop: 2 * k,
              fontSize: (story ? 16 : 14) * k,
              color: colors.primarySoft,
            }}
          >
            {tagline}
          </Text>
        </View>
        <Image
          source={CHEER}
          style={{
            width: cheerSize * k,
            height: cheerSize * k * CHEER_RATIO,
            marginBottom: -8 * k,
          }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

// 맨 위 라임 배지 + "n명이 골랐어요"
function TopLine({
  k,
  label,
  count,
}: {
  k: number;
  label: string;
  count?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * k }}>
      <View
        style={{
          paddingVertical: 6 * k,
          paddingHorizontal: 12 * k,
          borderRadius: 999,
          backgroundColor: colors.accent,
        }}
      >
        <Text
          style={{
            fontSize: 15 * k,
            fontWeight: "800",
            color: colors.onAccent,
          }}
        >
          {label}
        </Text>
      </View>
      {count !== undefined && (
        <Text style={{ fontSize: 15 * k, color: colors.primarySoft }}>
          {count}명이 골랐어요
        </Text>
      )}
    </View>
  );
}

function Question({
  k,
  text,
  size,
}: {
  k: number;
  text: string;
  size: number;
}) {
  return (
    <Text
      style={{
        marginTop: 18 * k,
        fontSize: size * k,
        lineHeight: size * 1.3 * k,
        fontWeight: "800",
        color: colors.onPrimary,
      }}
      numberOfLines={3}
    >
      {text}
    </Text>
  );
}

// ---------- 밸런스 ----------
export type BalanceShare = {
  kindLabel: string;
  question: string;
  labels: [string, string];
  counts: [number, number];
  // 내가 고른 편 (안 골랐으면 null → 칩 없이)
  mine: number | null;
  // 편 이름에 "파"를 붙일지 (밸런스·오늘의 질문 O, 나만 그래? X)
  suffix: boolean;
};

export function ShareBalance({
  ref,
  width,
  data,
}: {
  ref?: ViewRef;
  width: number;
  data: BalanceShare;
}) {
  const k = width / BASE;
  const total = data.counts[0] + data.counts[1];
  const pa = total === 0 ? 50 : Math.round((data.counts[0] / total) * 100);
  const pcts = [pa, 100 - pa];
  // 경계는 30~70%로 제한해 양쪽 숫자가 보이게
  const edge = Math.min(70, Math.max(30, pa));
  const side = (i: number) =>
    data.suffix ? `${data.labels[i]}파` : data.labels[i];
  const lead = pcts[0] === pcts[1] ? null : pcts[0] > pcts[1] ? 0 : 1;
  const status =
    data.mine === null
      ? lead === null
        ? "팽팽해요!"
        : `${side(lead)}가 ${Math.abs(pcts[0] - pcts[1])}%p 앞서는 중`
      : lead === null
        ? "팽팽해요!"
        : lead === data.mine
          ? "우리 편이 이기는 중"
          : "우리 편이 밀리는 중";

  return (
    <Frame
      ref={ref}
      width={width}
      tagline={
        data.suffix
          ? "너는 어느 파? 옛썰에서 골라 봐"
          : "너는? 옛썰에서 골라 봐"
      }
      cheerSize={104}
    >
      <TopLine k={k} label={data.kindLabel} count={total} />
      <Question k={k} text={data.question} size={36} />
      <View
        style={{
          marginTop: 26 * k,
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 12 * k,
        }}
      >
        <Text
          style={{
            flexShrink: 1,
            fontSize: 17 * k,
            fontWeight: "800",
            color: colors.onPrimary,
          }}
          numberOfLines={1}
        >
          {side(0)}
        </Text>
        <Text
          style={{
            flexShrink: 1,
            fontSize: 17 * k,
            fontWeight: "800",
            color: colors.accentLine,
          }}
          numberOfLines={1}
        >
          {side(1)}
        </Text>
      </View>
      <View style={{ marginTop: 10 * k, height: 96 * k }}>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            borderRadius: 24 * k,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${edge}%`,
              backgroundColor: colors.onPrimary,
              justifyContent: "center",
              paddingHorizontal: 22 * k,
            }}
          >
            <Text
              style={{
                fontSize: (lead === 1 ? 34 : 42) * k,
                fontWeight: "800",
                color: colors.primary,
              }}
            >
              {pcts[0]}%
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.accent,
              justifyContent: "center",
              alignItems: "flex-end",
              paddingHorizontal: 22 * k,
            }}
          >
            <Text
              style={{
                fontSize: (lead === 1 ? 42 : 34) * k,
                fontWeight: "800",
                color: colors.onAccent,
              }}
            >
              {pcts[1]}%
            </Text>
          </View>
        </View>
        <View
          style={{
            position: "absolute",
            left: `${edge}%`,
            top: 23 * k,
            marginLeft: -25 * k,
            width: 50 * k,
            height: 50 * k,
            borderRadius: 25 * k,
            borderWidth: 4 * k,
            borderColor: colors.primary,
            backgroundColor: colors.text,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 15 * k,
              fontWeight: "800",
              color: colors.accent,
            }}
          >
            VS
          </Text>
        </View>
      </View>
      <View
        style={{
          marginTop: 14 * k,
          flexDirection: "row",
          alignItems: "center",
          gap: 8 * k,
        }}
      >
        {data.mine !== null && (
          <View
            style={{
              paddingVertical: 6 * k,
              paddingHorizontal: 12 * k,
              borderRadius: 999,
              backgroundColor: WHITE_18,
            }}
          >
            <Text
              style={{
                fontSize: 16 * k,
                fontWeight: "700",
                color: colors.onPrimary,
              }}
            >
              나는{" "}
              {data.suffix ? side(data.mine) : `‘${data.labels[data.mine]}’`}
            </Text>
          </View>
        )}
        <Text
          style={{ flexShrink: 1, fontSize: 16 * k, color: colors.primarySoft }}
          numberOfLines={1}
        >
          {status}
        </Text>
      </View>
    </Frame>
  );
}

// ---------- 골라 줘 ----------
export type PickShare = {
  question: string;
  options: string[];
  counts: number[];
  mine: number | null;
};

export function SharePick({
  ref,
  width,
  data,
}: {
  ref?: ViewRef;
  width: number;
  data: PickShare;
}) {
  const k = width / BASE;
  const total = data.counts.reduce((a, b) => a + b, 0);
  const top = Math.max(0, ...data.counts);
  const pct = (c: number) => (total === 0 ? 0 : Math.round((c / total) * 100));
  const mineTop =
    data.mine !== null && top > 0 && data.counts[data.mine] === top;
  const tagline =
    data.mine === null
      ? "너라면 뭘 고를래? 옛썰에서 골라 봐"
      : mineTop
        ? "나도 1위 골랐어! 너는?"
        : "나만 다른 거 골랐나? 너는?";

  return (
    <Frame ref={ref} width={width} tagline={tagline} cheerSize={92}>
      <TopLine k={k} label="골라 줘" count={total} />
      <Question k={k} text={data.question} size={32} />
      <View style={{ marginTop: 22 * k, gap: 8 * k }}>
        {data.options.slice(0, 5).map((label, i) => {
          const c = data.counts[i] ?? 0;
          const isTop = top > 0 && c === top;
          const isMine = data.mine === i;
          const fill = isTop
            ? colors.onPrimary
            : isMine
              ? colors.primaryLight
              : WHITE_18;
          const fg = isTop || isMine ? colors.text : colors.onPrimary;
          return (
            <View
              key={i}
              style={{
                height: 50 * k,
                borderRadius: 14 * k,
                overflow: "hidden",
                backgroundColor: WHITE_14,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${pct(c)}%`,
                  backgroundColor: fill,
                }}
              />
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8 * k,
                  paddingHorizontal: 16 * k,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 18 * k,
                    fontWeight: isTop || isMine ? "800" : "500",
                    color: fg,
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {isMine && (
                  <Chip
                    k={k}
                    label="내 선택"
                    bg={colors.text}
                    fg={colors.accent}
                  />
                )}
                {isTop && (
                  <Chip
                    k={k}
                    label="1위"
                    bg={colors.accent}
                    fg={colors.onAccent}
                  />
                )}
                <Text
                  style={{
                    width: 52 * k,
                    textAlign: "right",
                    fontSize: 18 * k,
                    fontWeight: "800",
                    color: fg,
                  }}
                >
                  {pct(c)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Frame>
  );
}

function Chip({
  k,
  label,
  bg,
  fg,
}: {
  k: number;
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <View
      style={{
        paddingVertical: 3 * k,
        paddingHorizontal: 8 * k,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ fontSize: 12 * k, fontWeight: "800", color: fg }}>
        {label}
      </Text>
    </View>
  );
}

// ---------- 월드컵 ----------
export type WorldcupShare = {
  round: string;
  title: string;
  plays: number;
  mine: string;
  // "모두의 1위와 같아요!" · "모두의 순위로는 n위" · "나만 아는 1위"
  rankLine: string;
  top: { name: string; rate: number; mine: boolean }[];
};

export function ShareWorldcup({
  ref,
  width,
  data,
}: {
  ref?: ViewRef;
  width: number;
  data: WorldcupShare;
}) {
  const k = width / BASE;
  return (
    <Frame
      ref={ref}
      width={width}
      story
      tagline="너의 1위는? 옛썰에서 해 봐"
      cheerSize={140}
    >
      <TopLine k={k} label={`옛썰 월드컵 ${data.round}`} />
      <Question k={k} text={data.title} size={40} />
      <View
        style={{
          marginTop: 40 * k,
          paddingVertical: 30 * k,
          paddingHorizontal: 28 * k,
          borderRadius: 32 * k,
          backgroundColor: colors.onPrimary,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: 18 * k,
            fontWeight: "700",
            color: colors.iconStrong,
          }}
        >
          나의 우승
        </Text>
        <View style={{ marginTop: 10 * k }}>
          <AppIcon
            name={worldcupIcons.trophy}
            size={44 * k}
            color={colors.accent}
          />
        </View>
        <Text
          style={{
            marginTop: 8 * k,
            fontSize: 44 * k,
            lineHeight: 54 * k,
            fontWeight: "800",
            color: colors.primary,
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {data.mine}
        </Text>
        <View
          style={{
            marginTop: 14 * k,
            paddingVertical: 8 * k,
            paddingHorizontal: 14 * k,
            borderRadius: 999,
            backgroundColor: colors.accentSoft,
          }}
        >
          <Text
            style={{
              fontSize: 17 * k,
              fontWeight: "700",
              color: colors.onAccentSoft,
            }}
          >
            {data.rankLine}
          </Text>
        </View>
      </View>
      <Text
        style={{
          marginTop: 30 * k,
          fontSize: 18 * k,
          fontWeight: "800",
          color: colors.onPrimary,
        }}
      >
        모두의 순위{" "}
        <Text
          style={{
            fontSize: 15 * k,
            fontWeight: "500",
            color: colors.primarySoft,
          }}
        >
          · {data.plays}명 참여
        </Text>
      </Text>
      <View style={{ marginTop: 14 * k, gap: 12 * k }}>
        {data.top.map((t, i) => (
          <View
            key={t.name}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 * k }}
          >
            <View
              style={{
                width: 34 * k,
                height: 34 * k,
                borderRadius: 17 * k,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: i === 0 ? colors.accent : WHITE_18,
              }}
            >
              <Text
                style={{
                  fontSize: 16 * k,
                  fontWeight: "800",
                  color: i === 0 ? colors.onAccent : colors.onPrimary,
                }}
              >
                {i + 1}
              </Text>
            </View>
            <Text
              style={{
                width: 150 * k,
                fontSize: 19 * k,
                fontWeight: t.mine ? "800" : "500",
                color: colors.onPrimary,
              }}
              numberOfLines={1}
            >
              {t.name}
            </Text>
            <View
              style={{
                flex: 1,
                height: 12 * k,
                borderRadius: 999,
                overflow: "hidden",
                backgroundColor: WHITE_18,
              }}
            >
              <View
                style={{
                  width: `${t.rate}%`,
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: t.mine ? colors.accent : colors.onPrimary,
                }}
              />
            </View>
            <Text
              style={{
                width: 52 * k,
                textAlign: "right",
                fontSize: 17 * k,
                fontWeight: "700",
                color: colors.onPrimary,
              }}
            >
              {t.rate}%
            </Text>
          </View>
        ))}
      </View>
    </Frame>
  );
}

// 월드컵 "내 1위" 한 줄: 모두의 1위와 같은지 · 몇 위인지 · 아무도 우승으로 안 골랐는지
export function worldcupRankLine(rankIndex: number, wins: number): string {
  if (rankIndex < 0 || wins === 0) return "나만 아는 1위";
  if (rankIndex === 0) return "모두의 1위와 같아요!";
  return `모두의 순위로는 ${rankIndex + 1}위`;
}

// 이미지로 찍을 카드를 화면 밖에 그려 두는 자리 (보이지 않음, 찍을 때만 쓴다)
export const CAPTURE_WIDTH = 360;
export function ShareOffscreen({ children }: { children: ReactNode }) {
  return (
    <View
      style={{ position: "absolute", left: -10000, top: 0 }}
      pointerEvents="none"
    >
      {children}
    </View>
  );
}
