// CSV 만들기·내보내기 (집계 = 열람자·등록자, 원본 = 등록자). 개인을 알 수 있는 정보는 넣지 않는다
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { percent } from "@/components/results/QuestionResult";
import { showActions } from "@/lib/confirm";
import { type FullResults, GROUP_DIMS, sortGroups } from "@/lib/hub";
import { showNotice } from "@/lib/notice";
import { SCALE_LABELS, type QuestionType } from "@/lib/surveyDraft";

// get_survey_raw: 응답 한 사람 = 한 줄 (그룹 이름은 서버가 5명 미만이면 가림)
export type RawResults = {
  questions: { id: number; text: string; type: QuestionType }[];
  rows: { major: string; grade: string; gender: string; age: string; answers: (string | null)[] }[];
};

type Cell = string | number | null;

// 칸 하나: 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다.
// =, +, -, @로 시작하면 엑셀이 수식으로 실행할 수 있어 앞에 '를 붙인다 (남이 쓴 주관식 답 대비)
function cell(value: Cell): string {
  if (value === null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 표 → CSV 글자. 맨 앞 BOM은 엑셀에서 한글이 깨지지 않게
function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

// 집계 CSV: 전체 + 계열·학년·성별·나이대 그룹별, 문항·보기마다 응답 수와 비율. 주관식은 뺀다
export function aggregateCsv(full: FullResults): string {
  const rows: Cell[][] = [["구분", "그룹", "그룹 인원", "문항 번호", "문항", "보기", "응답 수", "비율(%)", "평균"]];

  const addQuestions = (dim: string, group: string, n: number, questions: FullResults["overall"]) => {
    questions.forEach((q, i) => {
      if (q.type === "single" || q.type === "multi") {
        q.options.forEach((o) =>
          rows.push([dim, group, n, i + 1, q.text, o.text, o.count, percent(o.count, q.answered), null]),
        );
      } else if (q.type === "scale" && q.scale) {
        q.scale.counts.forEach((count, j) =>
          rows.push([dim, group, n, i + 1, q.text, `${j + 1} ${SCALE_LABELS[j]}`, count, percent(count, q.answered), q.scale?.avg ?? null]),
        );
      }
    });
  };

  addQuestions("전체", "전체", full.total, full.overall);
  GROUP_DIMS.forEach((d) =>
    sortGroups(d.value, full.groups[d.value]).forEach((g) => {
      if (g.hidden || g.n === null) rows.push([d.label, g.label, "5명 미만이라 숨김", null, null, null, null, null, null]);
      else addQuestions(d.label, g.label, g.n, g.questions);
    }),
  );
  return toCsv(rows);
}

// 원본 CSV: 번호 · 계열 · 학년 · 성별 · 나이대 · 문항별 답
export function rawCsv(raw: RawResults): string {
  const header: Cell[] = ["번호", "계열", "학년", "성별", "나이대", ...raw.questions.map((q, i) => `${i + 1}. ${q.text}`)];
  const rows = raw.rows.map((r, i): Cell[] => [i + 1, r.major, r.grade, r.gender, r.age, ...r.answers]);
  return toCsv([header, ...rows]);
}

// 파일 이름: "옛썰_설문제목_집계.csv" (파일 이름에 못 쓰는 글자는 _로)
export function csvFileName(title: string, kind: "집계" | "원본"): string {
  // 한글·영문·숫자만 남긴다. [ ] # % 같은 기호는 안드로이드 파일 주소를 깨뜨릴 수 있다 (2026-11-07 안드로이드 CSV 실패)
  const safe = title
    .replace(/[^0-9A-Za-z가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return `옛썰_${safe}_${kind}.csv`;
}

// CSV 실패 안내 문구
// TODO(임시): 오류 이유 한 줄을 같이 보여 줌 (안드로이드 CSV 실패 원인 확인용) · 원인이 확인되면 "잠시 후 다시 시도해 주세요."만 남기기 · docs/PROGRESS.md
export function csvErrorMessage(e: unknown): string {
  const detail = e instanceof Error ? e.message : String(e);
  return `잠시 후 다시 시도해 주세요.\n(${detail.slice(0, 120)})`;
}

// CSV 받기 버튼 (집계·원본 공통). 실패 안내까지 여기서 한다
// - 웹·아이폰: 바로 다운로드 / 공유 창
// - 안드로이드: [폰에 저장]·[다른 앱으로 보내기] 고르기 (2026-11-07: 공유로 넘긴 파일을 카톡·메일·파일 앱이 못 받음)
export function exportCsv(title: string, kind: "집계" | "원본", text: string) {
  const fail = (e: unknown) => showNotice("파일을 만들지 못했어요", csvErrorMessage(e));
  if (Platform.OS !== "android") {
    shareCsv(csvFileName(title, kind), text).catch(fail);
    return;
  }
  showActions("CSV 받기", [
    { label: "폰에 저장 (폴더 고르기)", onPress: () => saveCsvToFolder(csvFileName(title, kind), text).catch(fail) },
    // 받는 앱이 한글 이름을 못 읽는 경우가 있어 영문 이름으로
    {
      label: "다른 앱으로 보내기",
      onPress: () => shareCsv(`yessur_${kind === "집계" ? "summary" : "raw"}.csv`, text).catch(fail),
    },
  ]);
}

// 안드로이드: 사용자가 고른 폴더(예: 다운로드)에 바로 저장. 고르기를 취소하면 아무 안내 없이 끝
async function saveCsvToFolder(fileName: string, text: string): Promise<void> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return;
  }
  const file = dir.createFile(fileName, "text/csv");
  file.write(text);
  showNotice("저장했어요", `고른 폴더에 ${fileName} 파일로 저장했어요.`);
}

// 폰: 임시 파일로 저장 → 공유 창 (카톡·메일·드라이브·파일 앱). 웹(개발 확인용): 바로 다운로드
export async function shareCsv(fileName: string, text: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: fileName,
  });
}
