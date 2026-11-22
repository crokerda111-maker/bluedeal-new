export const PC_PARTS = {
  cpu: "CPU", gpu: "그래픽카드", board: "메인보드", ram: "RAM", storage: "SSD·HDD",
  psu: "파워", cooler: "쿨러", case: "케이스",
} as const;
export type PcSlot = keyof typeof PC_PARTS;
export type PcKind = "fullpc" | "halfpc";
export type PcParts = Partial<Record<PcSlot, string>>;
export type PcObservation = {
  sourceId: string;
  productId: string;
  merchantUrl?: string;
  kind: PcKind;
  state: "observed" | "sold-out" | "option-review" | "unavailable";
  title: string;
  seller: string;
  checkedAt: string;
  price: number | null;
  shipping: number | null;
  cpu: string | null;
  gpu: string | null;
  parts: PcParts;
  excluded?: PcSlot[];
  quantities?: Partial<Record<PcSlot, number>>;
  os: string | null;
  warranty: string | null;
  configuration: string | null;
  detailDigest: string | null;
  note: string;
};
export type PcDay = {
  day: string;
  startedAt: string;
  completedAt: string;
  planned: number;
  sourceState: "complete" | "stopped";
  rows: PcObservation[];
};
type Criterion = { label: string; met: boolean };
type PartReview = {
  slot: PcSlot;
  name: string;
  url: string;
  checkedOn: string;
  criteria: Criterion[];
  caveat: string;
};
export type BuildReview = {
  configuration: string;
  detailDigest: string;
  slots: Readonly<Partial<Record<PcSlot, string>>>;
  compatible: boolean;
  issuesCleared: boolean;
};
export type QualityReview = {
  slot: keyof typeof PC_SCORE_RULES;
  name: string;
  criteria: [Criterion, Criterion, Criterion, Criterion, Criterion];
  sources: { url: string; kind: "official" | "independent"; checkedOn: string }[];
};

export const PC_SCORE_RULES = {
  board: { weight: 25, checks: "전원부 발열·전력 여유, BIOS 지원, 메모리·SSD 확장성, 포트, 보증" },
  ram: { weight: 15, checks: "총 용량, 모듈 수, 실속도·타이밍, 프로필 호환성, 보증" },
  storage: { weight: 15, checks: "용량, NAND 구성, 지속 쓰기 성능, 쓰기 내구성, 보증" },
  psu: { weight: 25, checks: "필요 출력·커넥터, 보호회로, 독립 부하 시험, 소음, 보증" },
  cooler: { weight: 12, checks: "소켓·케이스 호환, 방열 구조, 팬 구성, 실측 온도·소음, 보증" },
  case: { weight: 8, checks: "흡기·배기 구조, 기본 팬, 장착 여유, 조립 편의, 실측 온도·소음" },
} as const;

const qualitySlots = Object.keys(PC_SCORE_RULES) as (keyof typeof PC_SCORE_RULES)[];

export function kstDay(instant: string | number | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(instant));
}

export function isPcToday(checkedAt: string, now: number) {
  const at = Date.parse(checkedAt);
  return Number.isFinite(at) && at <= now && kstDay(at) === kstDay(now);
}

const partReviews: PartReview[] = [{
  slot: "board",
  name: "[MSI] MAG B850M 박격포 WIFI (AMD B850/M-ATX)",
  url: "https://www.msi.com/Motherboard/MAG-B850M-MORTAR-WIFI/Specification",
  checkedOn: "2026-11-22",
  criteria: [
    { label: "DDR5 슬롯 4개", met: true },
    { label: "M.2 슬롯 3개 이상", met: true },
    { label: "2.5Gbps 이상 유선랜 (5Gbps)", met: true },
    { label: "Wi-Fi 7", met: true },
    { label: "Flash BIOS 버튼", met: true },
  ],
  caveat: "확장성과 편의 사양 기준입니다. 실제 전원부 온도와 BIOS 버전, 국내 유통 보증은 별도 확인이 필요합니다.",
}, {
  slot: "board",
  name: "[MSI] PRO B650M-P (AMD B650/M-ATX)",
  url: "https://www.msi.com/Motherboard/PRO-B650M-P/Specification",
  checkedOn: "2026-11-22",
  criteria: [
    { label: "DDR5 슬롯 4개", met: true },
    { label: "M.2 슬롯 3개 이상 (이 모델은 2개)", met: false },
    { label: "2.5Gbps 이상 유선랜", met: true },
    { label: "Wi-Fi 7 내장", met: false },
    { label: "Flash BIOS 버튼", met: true },
  ],
  caveat: "저장장치 확장과 무선 기능을 보는 점수입니다. M.2가 두 개면 충분하거나 유선만 쓴다면 선택 기준이 달라집니다.",
}, {
  slot: "board",
  name: "[ASUS] TUF Gaming B850M-PLUS WIFI7 대원씨티에스 (AMD B850/M-ATX)",
  url: "https://www.asus.com/motherboards-components/motherboards/tuf-gaming/tuf-gaming-b850m-plus-wifi7/techspec/",
  checkedOn: "2026-11-22",
  criteria: [
    { label: "DDR5 슬롯 4개", met: true },
    { label: "M.2 슬롯 3개 이상", met: true },
    { label: "2.5Gbps 이상 유선랜", met: true },
    { label: "Wi-Fi 7 내장", met: true },
    { label: "BIOS FlashBack 버튼", met: true },
  ],
  caveat: "CPU에 따라 M.2 슬롯 동작 모드가 달라집니다. 실제 전원부 온도와 국내 유통 보증은 별도 확인이 필요합니다.",
}, {
  slot: "case",
  name: "[DAVEN] D7 Mesh 세븐팬 [미들타워] [블랙]",
  url: "https://daven.co.kr/board/notice/269",
  checkedOn: "2026-11-22",
  criteria: [
    { label: "메시 흡기 패널", met: true },
    { label: "팬 7개 기본 구성 표기", met: true },
    { label: "스냅핏 측면 패널", met: true },
    { label: "그래픽카드 지지대 기본 제공", met: true },
  ],
  caveat: "기본 구성 체크입니다. 팬 소음·온도와 그래픽카드·쿨러 장착 여유는 별도 확인이 필요합니다.",
}, {
  slot: "cooler",
  name: "3RSYS RC1900 ARGB 솔더링 블랙",
  url: "https://www.3rsys.com/shop/item.php?it_id=1701066030",
  checkedOn: "2026-11-22",
  criteria: [
    { label: "듀얼타워 방열판", met: true },
    { label: "FDB 팬 2개", met: true },
    { label: "AM5·LGA1700 장착 지원", met: true },
    { label: "높이 160mm 이하 (157mm)", met: true },
    { label: "방열판 5년·팬 3년 제조사 A/S 표기", met: true },
  ],
  caveat: "공식 사양 평가입니다. CPU 부하별 온도·소음, 실제 케이스 간격, 완본체에 적용되는 보증은 별도 확인이 필요합니다.",
}];

export function pcPartReview(slot: PcSlot, name: string | undefined) {
  const review = partReviews.find(entry => entry.slot === slot && entry.name.normalize("NFKC") === name?.normalize("NFKC"));
  if (!review) return null;
  return { ...review, score: review.criteria.filter(item => item.met).length };
}

function delivered(row: PcObservation) {
  return row.price === null || row.shipping === null ? null : row.price + row.shipping;
}

export function rankDailyPcs(rows: PcObservation[], now: number, reviews: BuildReview[] = [], qualityReviews: QualityReview[] = []) {
  const groups = new Map<string, { label: string; os: string | null; warranty: string | null; candidates: PcObservation[] }>();
  for (const row of rows) {
    if (row.state !== "observed" || !isPcToday(row.checkedAt, now) || delivered(row) === null || !row.cpu || !row.gpu || !row.configuration) continue;
    const label = `${row.cpu} · ${row.gpu}`;
    const key = JSON.stringify([row.kind, label, row.os, row.warranty, [...(row.excluded ?? [])].sort()]);
    const group = groups.get(key) ?? { label, os: row.os, warranty: row.warranty, candidates: [] };
    group.candidates.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const candidates = group.candidates.sort((a, b) => delivered(a)! - delivered(b)! || a.sourceId.localeCompare(b.sourceId));
    const scored = candidates.flatMap(row => {
      const review = reviews.find(entry => entry.configuration === row.configuration && entry.detailDigest === row.detailDigest);
      const included = qualitySlots.filter(slot => !row.excluded?.includes(slot));
      if (!row.os || !row.warranty || !review?.compatible || !review.issuesCleared || !row.detailDigest ||
          !included.every(slot => row.parts[slot] && row.parts[slot] === review.slots[slot])) return [];
      const scores = included.map(slot => qualityReviews.find(entry => entry.slot === slot && entry.name === row.parts[slot] &&
        entry.criteria.length === 5 && entry.sources.some(source => source.kind === "independent" && source.checkedOn <= kstDay(now))));
      const weight = included.reduce((total, slot) => total + PC_SCORE_RULES[slot].weight, 0);
      if (!weight || scores.some(score => !score)) return [];
      const quality = included.reduce((total, slot, i) =>
        total + scores[i]!.criteria.filter(criterion => criterion.met).length / 5 * PC_SCORE_RULES[slot].weight, 0) / weight * 100;
      return [{ row, quality }];
    });
    const basePrice = scored.length >= 2 ? Math.min(...scored.map(entry => delivered(entry.row)!)) : null;
    const ranked = basePrice === null ? [] : scored.map(entry => ({
      ...entry, score: Math.round(60 * basePrice / delivered(entry.row)! + 0.4 * entry.quality),
    })).sort((a, b) => b.score - a.score || b.quality - a.quality || delivered(a.row)! - delivered(b.row)! || a.row.sourceId.localeCompare(b.row.sourceId));
    const qualityLeader = ranked.length ? [...ranked].sort((a, b) => b.quality - a.quality || a.row.sourceId.localeCompare(b.row.sourceId))[0].row.sourceId : null;
    return { ...group, candidates, ranked, qualityLeader };
  }).sort((a, b) => delivered(a.candidates[0])! - delivered(b.candidates[0])!);
}
