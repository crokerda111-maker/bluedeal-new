import type {
  BoardGroup,
  BoardKey,
  CommunityBoardKey,
  InquiryBoardKey,
  InquiryVisibility,
  PostType,
} from "./postTypes";

export const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string; hint?: string }> = [
  { value: "general", label: "일반", hint: "정보 공유/잡담" },
  { value: "question", label: "질문", hint: "문제 해결/추천 요청" },
  { value: "tip", label: "팁", hint: "세팅/노하우" },
];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  general: "일반",
  question: "질문",
  tip: "팁",
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
  slug: string;
  title: string;
  description: string;
  writeHint?: string;
  extraFields?: FieldDef[];
};

export const COMMUNITY_BOARDS: BoardDef[] = [
  {
    key: "review",
    group: "community",
    slug: "review",
    title: "리뷰",
    description: "제품 사용기/후기 공유",
    writeHint: "제품명, 장단점, 실사용 느낌을 적어주세요.",
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
      { key: "pros", label: "장점", type: "textarea", placeholder: "좋았던 점을 bullet로 적어도 됨" },
      { key: "cons", label: "단점", type: "textarea", placeholder: "아쉬운 점/주의할 점" },
    ],
  },
  {
    key: "hardware",
    group: "community",
    slug: "hardware",
    title: "하드웨어",
    description: "부품 질문/추천/호환성",
    writeHint: "세팅/예산/용도를 같이 적으면 답변이 빨라집니다.",
    extraFields: [
      {
        key: "part",
        label: "부품 분류",
        type: "select",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "gpu", label: "그래픽카드" },
          { value: "ram", label: "RAM" },
          { value: "motherboard", label: "메인보드" },
          { value: "ssd", label: "SSD" },
          { value: "psu", label: "파워" },
          { value: "case", label: "케이스" },
          { value: "cooler", label: "쿨러" },
          { value: "etc", label: "기타" },
        ],
      },
      { key: "budget", label: "예산(선택)", type: "text", placeholder: "예: 120만원" },
      { key: "usage", label: "용도(선택)", type: "text", placeholder: "예: QHD 144Hz 게임, 영상 편집" },
    ],
  },
  {
    key: "overclock",
    group: "community",
    slug: "overclock",
    title: "오버클럭",
    description: "PBO/언더볼팅/램 타이밍",
    writeHint: "세팅 값 + 테스트 방법(OCCT/Prime95 등) + 온도/전력 기록을 같이 적어주세요.",
    extraFields: [
      {
        key: "target",
        label: "대상",
        type: "select",
        options: [
          { value: "cpu", label: "CPU" },
          { value: "gpu", label: "GPU" },
          { value: "ram", label: "RAM" },
        ],
      },
      { key: "setting", label: "세팅 요약", type: "textarea", placeholder: "예: PBO -20, LLC 3, 6000 CL30..." },
      { key: "stability", label: "안정화/테스트", type: "text", placeholder: "예: OCCT 30m, Cinebench 10회" },
      { key: "temp", label: "온도/전력(선택)", type: "text", placeholder: "예: max 82°C / 120W" },
    ],
  },
  {
    key: "resources",
    group: "community",
    slug: "resources",
    title: "자료실",
    description: "유틸/드라이버/가이드 링크",
    writeHint: "출처 링크와 간단 요약을 같이 남겨주세요.",
    extraFields: [
      {
        key: "kind",
        label: "자료 종류",
        type: "select",
        options: [
          { value: "utility", label: "유틸" },
          { value: "driver", label: "드라이버" },
          { value: "guide", label: "가이드" },
          { value: "etc", label: "기타" },
        ],
      },
      { key: "link", label: "링크(URL)", type: "url", required: true, placeholder: "https://..." },
      { key: "license", label: "라이선스/주의(선택)", type: "text", placeholder: "예: 공식 배포, 개인 배포 금지" },
    ],
  },
];

export const INQUIRY_BOARDS: BoardDef[] = [
  {
    key: "inquiry_public",
    group: "inquiry",
    slug: "public",
    title: "공개 문의",
    description: "운영/제휴/오류 제보(공개)",
    writeHint: "개인정보는 적지 마세요. 링크/스크린샷 정보가 있으면 정확도가 올라갑니다.",
    extraFields: [
      { key: "email", label: "연락 이메일(선택)", type: "text", placeholder: "reply@example.com" },
    ],
  },
  {
    key: "inquiry_private",
    group: "inquiry",
    slug: "private",
    title: "비공개 문의",
    description: "개인정보/견적/민감한 문의(비공개)",
    writeHint: "비공개 글은 비밀번호로 잠깁니다.",
    extraFields: [
      { key: "email", label: "연락 이메일(선택)", type: "text", placeholder: "reply@example.com" },
      { key: "phone", label: "연락처(선택)", type: "text", placeholder: "010-0000-0000" },
    ],
  },
];

export const ALL_BOARDS: BoardDef[] = [...COMMUNITY_BOARDS, ...INQUIRY_BOARDS];

export function getCommunityBoard(slug: string): BoardDef | undefined {
  return COMMUNITY_BOARDS.find((b) => b.slug === slug);
}

export function getInquiryBoard(visibility: InquiryVisibility): BoardDef | undefined {
  return INQUIRY_BOARDS.find((b) => b.slug === visibility);
}

export function isCommunityBoardSlug(slug: string): slug is CommunityBoardKey {
  return (COMMUNITY_BOARDS as BoardDef[]).some((b) => b.slug === slug);
}

export function inquiryVisibilityToBoardKey(v: InquiryVisibility): InquiryBoardKey {
  return v === "public" ? "inquiry_public" : "inquiry_private";
}

export function boardKeyToSlug(key: BoardKey): string {
  const b = ALL_BOARDS.find((x) => x.key === key);
  return b?.slug ?? String(key);
}
