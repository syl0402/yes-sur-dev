import { supabase } from "@/lib/supabase";

// point_rules 표의 설정값을 key → 숫자로 읽는다 (화면에 한도·기본값·예상 금액을 보여줄 때)
// 실제 지급·차감 금액은 항상 서버 함수가 정한다
export async function fetchRules(keys: string[]): Promise<Record<string, number>> {
  const { data } = await supabase.from("point_rules").select("key, value").in("key", keys);
  const rules: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    rules[r.key] = Number(r.value);
  });
  return rules;
}
