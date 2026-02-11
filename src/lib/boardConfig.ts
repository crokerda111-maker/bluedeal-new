import type { BoardGroup, BoardKey, CommunityBoardKey, PostType } from "./postTypes";

export const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string; hint?: string }> = [
  { value: "general", label: "일반", hint: "정보 공유/잡담" },
  { value: "question", label: "질문", hint: "문제 해결/추천 요청" },
  { value: "tip", label: "팁", hint: "세팅/노하우" },

  // 리뷰 전용 말머리
  { value: "monitor", label: "모니터", hint: "리뷰: 모니터" },
  { value: "sound", label: "사운드", hint: "리뷰: 사운드" },
  { value: "parts", label: "컴퓨터 부품", hint: "리뷰: 컴퓨터 부품" },
  { value: "kbdmouse", label: "키보드/마우스", hint: "리뷰: 키보드/마우스" },
];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  general: "일반",
  question: "질문",
  tip: "팁",
  monitor: "모니터",
  sound: "사운드",
  parts: "컴퓨터 부품",
  kbdmouse: "키보드/마우스",
};

export type FieldType = "text" | "textarea" | "number" | "select" | "url";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
};

export type BoardDef = {
  key: BoardKey;
  group: BoardGroup;
  /** URL slug (커뮤니티의 경우 /community/{slug}) */
  slug: string;
  title: string;
  description: string;
  writeHint?: string;
  extraFields?: FieldDef[];
  /** 게시판에서 허용하는 말머리(없으면 기본 3종: 일반/질문/팁) */
  allowedTypes?: PostType[];
};

export function getAllowedTypes(board?: BoardDef): PostType[] {
  if (board?.allowedTypes && board.allowedTypes.length) return board.allowedTypes;
  return ["general", "question", "tip"];
}

export function getTypeOptionsForBoard(board?: BoardDef): Array<{ value: PostType; label: string; hint?: string }> {
  const allowed = new Set(getAllowedTypes(board));
  return POST_TYPE_OPTIONS.filter((o) => allowed.has(o.value));
}

/** IT 소식(통합) */
export const IT_BOARD: BoardDef = {
  key: "it",
  group: "it",
  slug: "it",
  title: "IT 소식",
  description: "IT 뉴스/루머/업데이트/이슈 요약",
  writeHint: "출처가 있으면 링크를 함께 남기세요. (루머/추측은 구분해서 작성)",
  allowedTypes: ["general"],
  extraFields: [
    { key: "source", label: "출처(선택)", type: "url", placeholder: "https://..." },
    { key: "tag", label: "태그(선택)", type: "text", placeholder: "예: GPU, RAM, Windows" },
  ],
};

export const COMMUNITY_BOARDS: BoardDef[] = [
  {
    key: "review",
    group: "community",
    slug: "review",
    title: "리뷰",
    description: "제품 사용기/후기 공유",
    writeHint: "제품명과 실사용 느낌을 적어주세요.",
    allowedTypes: ["monitor", "sound", "parts", "kbdmouse"],
    extraFields: [
      { key: "product", label: "제품명", type: "text", required: true, placeholder: "예: RTX 4070 SUPER (제조사/모델)" },
      {
        key: "rating",
        label: "만족도(1~5)",
        type: "select",
        options: [
          { value: "5", label: "5 (매우 만족)" },
          { value: "4", label: "4" },
          { value: "3", label: "3" },
          { value: "2", label: "2" },
          { value: "1", label: "1 (비추천)" },
        ],
      },
    ],
  },
  {
    key: "hardware",
    group: "community",
    slug: "hardware",
    title: "하드웨어",
    description: "부품 질문/추천/호환성",
    writeHint: "세팅/조건을 같이 적으면 답변이 빨라집니다.",
    extraFields: [
      {
        key: "part",
        label: "부품 분류",
        type: "select",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "motherboard", label: "메인보드" },
          { value: "ram", label: "RAM" },
          { value: "ssd", label: "SSD" },
          { value: "case", label: "케이스" },
          { value: "etc", label: "기타" },
        ],
      },
    ],
  },
  {
    key: "overclock",
    group: "community",
    slug: "overclock",
    title: "오버클럭",
    description: "PBO/언더볼팅/램 타이밍",
    writeHint: "세팅 값 + 테스트 방법(OCCT/Prime95 등)을 같이 적어주세요.",
    extraFields: [
      {
        key: "target",
        label: "대상",
        type: "select",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "ram", label: "RAM" },
          { value: "gpu", label: "그래픽카드" },
        ],
      },
      { key: "setting", label: "세팅 요약", type: "textarea", placeholder: "예: PBO -20, LLC 3, 6000 CL30..." },
      { key: "stability", label: "안정화/테스트", type: "text", placeholder: "예: OCCT 30m, Cinebench 10회" },
    ],
  },
  {
    key: "issue",
    group: "community",
    slug: "issue",
    title: "이슈공유",
    description: "업데이트/드라이버/불량/사건 이슈 공유",
    writeHint: "환경(OS/버전/드라이버) + 증상 + 해결 여부를 같이 적어주세요.",
    allowedTypes: ["general"],
    extraFields: [
      { key: "env", label: "환경(선택)", type: "text", placeholder: "예: Windows 11 23H2 / RTX 4070S / 드라이버 551.xx" },
      { key: "ref", label: "참고 링크(선택)", type: "url", placeholder: "https://..." },
    ],
  },
  {
    key: "resources",
    group: "community",
    slug: "resources",
    title: "자료실",
    description: "드라이버/모니터링/안정화 자료",
    writeHint: "가능하면 공식 배포처/출처를 적어주세요.",
    allowedTypes: ["general"],
    extraFields: [
      {
        key: "kind",
        label: "자료 종류",
        type: "select",
        options: [
          { value: "driver", label: "드라이버" },
          { value: "monitoring", label: "모니터링" },
          { value: "stability", label: "안정화" },
          { value: "other", label: "기타" },
        ],
      },
      { key: "link", label: "링크(URL)", type: "url", required: true, placeholder: "https://..." },
    ],
  },
  {
    key: "hotdeal",
    group: "community",
    slug: "hotdeal",
    title: "핫딜",
    description: "유저 핫딜 공유 게시판",
    writeHint: "가격/구성/조건을 함께 적고, 원문/구매 링크를 꼭 남겨주세요.",
    allowedTypes: ["general"],
    extraFields: [
      {
        key: "category",
        label: "카테고리(선택)",
        type: "select",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "gpu", label: "GPU" },
          { value: "ssd", label: "SSD" },
          { value: "ram", label: "RAM" },
          { value: "monitor", label: "모니터" },
          { value: "peripheral", label: "주변기기" },
          { value: "etc", label: "기타" },
        ],
      },
      { key: "store", label: "스토어(선택)", type: "text", placeholder: "예: 쿠팡, 11번가" },
      { key: "price", label: "가격(선택)", type: "text", placeholder: "예: 199,000원" },
      { key: "dealLink", label: "원문/구매 링크(URL)", type: "url", required: true, placeholder: "https://..." },
    ],
  },
];

/** 문의(통합) */
export const INQUIRY_BOARD: BoardDef = {
  key: "inquiry",
  group: "inquiry",
  slug: "contact",
  title: "문의",
  description: "운영/제휴/오류 제보",
  writeHint: "개인정보는 적지 마세요. 링크/스크린샷 정보가 있으면 정확도가 올라갑니다.",
  extraFields: [{ key: "email", label: "연락 이메일(선택)", type: "text", placeholder: "reply@example.com" }],
};

export const ALL_BOARDS: BoardDef[] = [IT_BOARD, ...COMMUNITY_BOARDS, INQUIRY_BOARD];

export function getBoardByKey(key: BoardKey): BoardDef | undefined {
  return ALL_BOARDS.find((b) => b.key === key);
}

export function getCommunityBoard(slug: string): BoardDef | undefined {
  return COMMUNITY_BOARDS.find((b) => b.slug === slug);
}

export function isCommunityBoardSlug(slug: string): slug is CommunityBoardKey {
  return (COMMUNITY_BOARDS as BoardDef[]).some((b) => b.slug === slug);
}

export function boardKeyToSlug(key: BoardKey): string {
  const b = ALL_BOARDS.find((x) => x.key === key);
  return b?.slug ?? String(key);
}

export function boardKeyToPath(key: BoardKey): string {
  const b = ALL_BOARDS.find((x) => x.key === key);
  if (!b) return "/";
  if (b.key === "it") return "/it";
  if (b.key === "inquiry") return "/contact";
  return `/community/${b.slug}`;
}
