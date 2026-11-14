// 공유 미리보기 창 (2026-11-14, 데이터 허브 결과 카드 공유 시트와 같은 흐름·모양)
// 아래에서 올라와 카드를 작게 미리 보여 주고 → [이미지로 공유] → 큰 카드(화면 밖)를 1080px로 찍어 폰 공유 창
// renderCard(width, ref): 같은 카드 부품을 미리보기(작게)와 찍을 용(크게)으로 두 번 그린다
import {
  type ComponentRef,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import {
  CAPTURE_WIDTH,
  ShareOffscreen,
} from "@/components/share/CommunityShareCards";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { colors, fontSize, radius, spacing } from "@/constants/theme";
import { type ShareKind, type ShareShape, shareViewAsImage } from "@/lib/shareImage";

type ViewRef = Ref<ComponentRef<typeof View>>;

type Props = {
  shape: ShareShape;
  // 어떤 결과 카드인지 (웰컴 미션 기록용)
  kind: ShareKind;
  renderCard: (width: number, ref?: ViewRef) => ReactNode;
  onClose: () => void;
};

// 미리보기 크기 (데이터 허브와 같게: 정사각 240 · 스토리 172)
const PREVIEW_WIDTH: Record<ShareShape, number> = { square: 240, story: 172 };

export default function SharePreviewSheet({
  shape,
  kind,
  renderCard,
  onClose,
}: Props) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    await shareViewAsImage(ref, shape, "결과 공유", kind);
    setSharing(false);
  };

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title}>결과 카드로 공유</Text>

      <View style={styles.preview}>
        <View style={styles.previewShadow}>
          {renderCard(PREVIEW_WIDTH[shape])}
        </View>
      </View>
      <Text style={styles.hint}>
        {shape === "story"
          ? "인스타 스토리에 딱 맞는 세로형이에요"
          : "카톡·피드에 올리기 좋은 정사각형이에요"}{" "}
        · 공유 창에서 사진 저장도 할 수 있어요
      </Text>

      <Button
        title="이미지로 공유"
        onPress={share}
        loading={sharing}
        style={styles.button}
      />

      {/* 이미지로 찍을 큰 카드 (화면 밖) */}
      <ShareOffscreen>{renderCard(CAPTURE_WIDTH, ref)}</ShareOffscreen>
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
  hint: {
    marginTop: 10,
    textAlign: "center",
    fontSize: fontSize.caption,
    color: colors.iconStrong,
  },
  button: {
    marginTop: spacing.md,
  },
});
