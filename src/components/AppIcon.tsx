import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { SvgXml } from "react-native-svg";

import { FIGMA_ICONS, type FigmaIconName } from "@/constants/figmaIcons";
import type { IconName } from "@/constants/icons";

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
};

// 앱 공용 아이콘. "fig-"로 시작하면 피그마 시안 그림(SVG), 아니면 Ionicons (2026-11-10)
// 아이콘 이름은 src/constants/icons.ts에서 고른다 (화면에서 직접 이름을 쓰지 않음)
export default function AppIcon({ name, size = 24, color }: Props) {
  // 탭 바가 넘겨주는 색 타입이 넓어서, 아이콘이 받는 글자 색(string)만 넘긴다
  const c = typeof color === "string" ? color : undefined;
  if (name in FIGMA_ICONS) {
    return <SvgXml xml={FIGMA_ICONS[name as FigmaIconName]} width={size} height={size} color={c} />;
  }
  return <Ionicons name={name as ComponentProps<typeof Ionicons>["name"]} size={size} color={c} />;
}
