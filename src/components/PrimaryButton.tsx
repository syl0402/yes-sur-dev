import Button from "@/components/ui/Button";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  // true면 돌아가는 표시를 보여주고 누르기를 막는다 (연타 방지)
  loading?: boolean;
};

// 큰 파란 버튼 (예전 이름 그대로. 새 화면은 @/components/ui/Button을 써도 된다)
export default function PrimaryButton(props: Props) {
  return <Button {...props} />;
}
