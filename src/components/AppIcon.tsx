import Ionicons from "@expo/vector-icons/Ionicons";
import type { ColorValue } from "react-native";

import type { IconName } from "@/constants/icons";

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
};

// 앱 공용 아이콘. 나중에 디자인팀이 직접 그린 아이콘으로 바꿀 때 이 파일만 고치면 된다
export default function AppIcon({ name, size = 24, color }: Props) {
  // 탭 바가 넘겨주는 색 타입이 넓어서, 아이콘이 받는 글자 색(string)만 넘긴다
  return <Ionicons name={name} size={size} color={typeof color === "string" ? color : undefined} />;
}
