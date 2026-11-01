// 커뮤니티 월드컵 (ys-145 · F-608). 서버 함수 모양은 docs/DB.md "월드컵"

export type Candidate = { id: number; name: string };

// get_worldcups 한 줄
export type WorldcupItem = { id: number; title: string; size: number; plays: number; played: boolean };

// get_worldcup
export type Worldcup = {
  id: number;
  title: string;
  description: string | null;
  size: number;
  played: boolean;
  candidates: Candidate[];
};

// get_worldcup_result
export type WorldcupResult = {
  plays: number;
  ranking: {
    id: number;
    name: string;
    wins: number;
    win_rate: number;
    match_wins: number;
    match_losses: number;
    match_rate: number;
  }[];
  // 인원이 적은 그룹은 hidden (1위를 보여 주지 않음)
  groups: { dim: "major" | "gender"; label: string; hidden: boolean; n: number | null; top: string | null }[];
};

export type Match = { winner: number; loser: number };

// 진행 중인 대진: 이번 라운드 후보 · 다음 라운드로 올라간 후보 · 이번 라운드에서 몇 번째 대결인지 · 지금까지 결과
export type Bracket = { round: Candidate[]; next: Candidate[]; pair: number; matches: Match[] };

// "8강", "4강", "결승"
export function roundLabel(n: number): string {
  return n === 2 ? "결승" : `${n}강`;
}

// 후보를 섞어서 첫 라운드 시작 (매번 대진이 달라지게)
export function startBracket(candidates: Candidate[]): Bracket {
  const round = [...candidates];
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return { round, next: [], pair: 0, matches: [] };
}

// 지금 대결하는 두 후보
export function currentPair(b: Bracket): [Candidate, Candidate] {
  return [b.round[b.pair * 2], b.round[b.pair * 2 + 1]];
}

// 둘 중 하나(0 또는 1)를 고른다 → 다음 대진, 또는 끝났으면 우승 후보
export function pick(b: Bracket, side: 0 | 1): { bracket: Bracket; champion: Candidate | null } {
  const [a, c] = currentPair(b);
  const winner = side === 0 ? a : c;
  const loser = side === 0 ? c : a;
  const matches = [...b.matches, { winner: winner.id, loser: loser.id }];
  const next = [...b.next, winner];
  const pair = b.pair + 1;

  if (pair * 2 < b.round.length) return { bracket: { ...b, next, pair, matches }, champion: null };
  if (next.length === 1) return { bracket: { round: next, next: [], pair: 0, matches }, champion: winner };
  return { bracket: { round: next, next: [], pair: 0, matches }, champion: null };
}
