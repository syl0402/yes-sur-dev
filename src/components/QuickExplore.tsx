// 홈 "빠른 탐색": 설문 카테고리 8칸 (한 줄 4칸 × 2줄). 누르면 설문 탭이 그 카테고리로 걸러진 채 열린다 (2026-11-10 피그마 홈 시안)
// 카테고리 이름·순서는 survey_categories 표에서 읽는다 (표가 바뀌면 칸도 따라 바뀜)
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import SectionHeader from "@/components/ui/SectionHeader";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

// 카테고리 key → 캐릭터 (피그마 "캐릭터 파일" 145:3900)
// TODO(임시): 기타(community)는 취향·문화와 같은 응원 캐릭터 · 디자인팀이 기타용 캐릭터를 주면 교체 · 캐릭터 7종 < 카테고리 8개
const CHARACTERS: Record<string, number> = {
  study: require("../../assets/images/characters/study.png"),
  career: require("../../assets/images/characters/headset.png"),
  life: require("../../assets/images/characters/chef.png"),
  consume: require("../../assets/images/characters/coin.png"),
  taste: require("../../assets/images/characters/cheer.png"),
  relation: require("../../assets/images/characters/phone.png"),
  society: require("../../assets/images/characters/question.png"),
  community: require("../../assets/images/characters/cheer.png"),
};
// 표에 새 카테고리가 생겼는데 캐릭터가 아직 없을 때
const FALLBACK = require("../../assets/images/characters/cheer.png");

type Category = { key: string; name: string };

export default function QuickExplore() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from("survey_categories")
      .select("key, name")
      .order("sort_order")
      .then(({ data }) => setCategories(data ?? []));
  }, []);

  if (categories.length === 0) return null;

  return (
    <View>
      <SectionHeader title="빠른 탐색" subtitle="관심 카테고리를 골라 보세요" />
      <View style={styles.grid}>
        {categories.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => router.navigate({ pathname: "/surveys", params: { category: c.key } })}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            accessibilityLabel={`${c.name} 설문 보기`}
          >
            <Image source={CHARACTERS[c.key] ?? FALLBACK} style={styles.character} contentFit="contain" />
            <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const GAP = spacing.sm;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
    marginTop: spacing.sm,
  },
  // 한 줄 4칸: 22%씩 차지하고 남는 폭은 나눠 가짐 (5칸은 110%라 다음 줄로)
  tile: {
    flexGrow: 1,
    flexBasis: "22%",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },
  character: {
    width: 44,
    height: 38,
  },
  name: {
    fontSize: fontSize.small,
    fontWeight: "600",
    color: colors.text,
  },
});
