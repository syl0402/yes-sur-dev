// 설문 보상 연락처 (2026-11-07). 작성자가 보상 안내를 켠 설문만, 응답자가 원할 때 휴대폰 번호를 남긴다.
// 번호는 서버 함수로만 오가고(작성자만 목록 조회), 남긴 날부터 reward_contact_keep_days일 뒤 자동 삭제
import { supabase } from "@/lib/supabase";

// 보상 안내 글 (보상을 안 켠 설문이면 null)
export async function fetchSurveyReward(surveyId: number): Promise<string | null> {
  const { data } = await supabase.from("survey_rewards").select("note").eq("survey_id", surveyId).maybeSingle();
  return data?.note ?? null;
}
