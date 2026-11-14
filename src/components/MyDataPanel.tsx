// "내 데이터": [응답한 | 스크랩 | 열람한] 결과를 한 곳에 (2026-11-09 개인 피드백 14번)
// 2026-11-14 마이 탭 시안 ⑤: 전용 화면(my-data)으로. 탭마다 안내 한 줄 · 줄은 칩 없이 "카테고리 · 마감 · 응답 수" + 오른쪽 "결과 보기"
// 새 서버 함수 없음 (fetchMyDataRows: get_hub_list · get_my_bookmarks · get_my_views). 모두 본인 것만
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ListRow, { rowsCard } from "@/components/ui/ListRow";
import { Text } from "@/components/ui/Text";
import TextTabs from "@/components/ui/TextTabs";
import { colors, fontSize, spacing } from "@/constants/theme";
import { type DataRow, type DataTab, fetchMyDataRows } from "@/lib/myActivity";

const EMPTY: Record<DataTab, { title: string; message: string; emoji: string }> = {
  answered: {
    title: "아직 볼 수 있는 결과가 없어요",
    message: "내가 응답한 설문이 마감되고 결과가 공개되면 여기에 보여요.",
    emoji: "🙋",
  },
  saved: { title: "스크랩한 결과가 없어요", message: "결과 화면 오른쪽 위 책갈피를 누르면 여기에 모여요.", emoji: "🔖" },
  viewed: { title: "열람한 결과가 없어요", message: "데이터 탭에서 다른 설문 결과를 볼 수 있어요.", emoji: "📊" },
};

// 탭마다 안내 한 줄
const HINT: Record<DataTab, string> = {
  answered: "내가 응답한 설문 중 결과가 공개된 것이에요.",
  saved: "결과 화면에서 책갈피를 누른 것이에요.",
  viewed: "데이터 탭에서 열람한 결과예요. 다시 볼 때는 포인트가 들지 않아요.",
};

export default function MyDataPanel() {
  const [tab, setTab] = useState<DataTab>("answered");
  const [rows, setRows] = useState<Record<DataTab, DataRow[]> | null>(null);

  // 결과 화면에서 스크랩을 풀고 돌아오면 바로 빠지게 매번 새로 불러온다
  useFocusEffect(
    useCallback(() => {
      fetchMyDataRows().then(setRows);
    }, []),
  );

  if (rows === null) return <ActivityIndicator color={colors.primary} style={styles.loading} />;

  const shown = rows[tab];
  return (
    <>
      <TextTabs
        options={[
          { value: "answered", label: `응답한 ${rows.answered.length}` },
          { value: "saved", label: `스크랩 ${rows.saved.length}` },
          { value: "viewed", label: `열람한 ${rows.viewed.length}` },
        ]}
        value={tab}
        onChange={setTab}
        fill
      />
      <Text style={styles.hint}>{HINT[tab]}</Text>
      {shown.length === 0 ? (
        <EmptyState {...EMPTY[tab]} />
      ) : (
        <Card style={rowsCard}>
          {shown.map((r, i) => (
            <ListRow
              key={r.id}
              first={i === 0}
              title={r.title}
              sub={r.sub}
              value="결과 보기"
              valueTone="primary"
              onPress={() => router.push({ pathname: "/data/[id]", params: { id: String(r.id) } })}
            />
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.lg,
  },
  hint: {
    fontSize: fontSize.small,
    color: colors.iconStrong,
  },
});
