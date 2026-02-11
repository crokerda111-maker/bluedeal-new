import type { Post } from "./postTypes";

const now = new Date();
const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();

/**
 * Seed posts (데모)
 * - 온라인 게시판(KV)이 비활성/미설정일 때 샘플로 노출됩니다.
 */
export const MOCK_POSTS: Post[] = [
  // IT 소식
  {
    id: "seed-it-1",
    boardKey: "it",
    type: "general",
    title: "(샘플) GPU 신제품 루머/요약 모음",
    content:
      "정리형 글(샘플)입니다. 출시 일정/가격/성능 루머는 변동될 수 있습니다.\n\n- 제품군: 중상급\n- 출시: 미정\n- 참고: 출처 링크 확인\n",
    createdAt: iso(60 * 10),
    extra: { tag: "GPU", source: "https://example.com" },
  },
  {
    id: "seed-it-2",
    boardKey: "it",
    type: "general",
    title: "(샘플) Windows 업데이트 전 확인 체크리스트",
    content:
      "업데이트 전/후에 문제가 자주 생기는 포인트를 짧게 정리합니다.\n\n1) 드라이버 백업\n2) 복원 지점 생성\n3) 문제 발생 시 롤백 방법\n",
    createdAt: iso(60 * 5),
    extra: { tag: "Windows", source: "https://example.com" },
  },

  // 커뮤니티
  {
    id: "seed-review-1",
    boardKey: "review",
    type: "parts",
    title: "(샘플) DDR5 6000 CL30 메모리 실사용 후기",
    content:
      "게임/작업에서 체감은 크지 않지만, 안정화/호환성 체크 포인트를 정리했습니다.\n\n- XMP/EXPO 적용\n- 전압/온도\n- 호환성(보드 QVL)\n",
    createdAt: iso(60 * 12),
    authorName: "블루딜러-1001",
    extra: {
      product: "DDR5 32GB(16x2) 6000 CL30",
      rating: "4",
    },
  },
  {
    id: "seed-hardware-1",
    boardKey: "hardware",
    type: "question",
    title: "(샘플) B650 보드 추천 부탁",
    content:
      "AM5로 넘어가려고 하는데, B650 보드 중 전원부/확장성 무난한 제품 추천 부탁합니다.\n\n- 조건: 25~30만원\n- 용도: QHD 144Hz 게임\n",
    createdAt: iso(60 * 6),
    authorName: "블루딜러-2210",
    extra: { part: "motherboard" },
  },
  {
    id: "seed-oc-1",
    boardKey: "overclock",
    type: "tip",
    title: "(샘플) 7800X3D PBO -20 세팅 공유",
    content:
      "PBO + Curve Optimizer로 전력/온도 줄이면서 프레임 유지한 세팅입니다.\n\n- CO: -20\n- PPT/TDC/EDC: Auto\n- 테스트: OCCT 30m\n",
    createdAt: iso(60 * 3),
    authorName: "블루딜러-4821",
    extra: { target: "cpu", setting: "CO -20", stability: "OCCT 30m" },
  },
  {
    id: "seed-issue-1",
    boardKey: "issue",
    type: "general",
    title: "(샘플) 최신 GPU 드라이버에서 게임 튕김 이슈",
    content:
      "특정 게임에서 최신 드라이버 적용 후 튕김이 잦다는 제보가 있습니다.\n\n- 재현: 특정 옵션/해상도\n- 임시 해결: 롤백/클린 설치\n",
    createdAt: iso(60 * 2),
    authorName: "블루딜러-9000",
    extra: { env: "Windows 11 / RTX 40 / Driver 55x", ref: "https://example.com" },
  },
  {
    id: "seed-res-1",
    boardKey: "resources",
    type: "general",
    title: "(샘플) 모니터링 툴 모음 링크",
    content: "자주 쓰는 모니터링 툴 링크 모음(샘플)입니다. 가능하면 공식 배포처만 공유해주세요.",
    createdAt: iso(60 * 1),
    authorName: "블루딜러-3301",
    extra: { kind: "monitoring", link: "https://example.com" },
  },
  {
    id: "seed-hotdeal-1",
    boardKey: "hotdeal",
    type: "general",
    title: "(샘플) SSD 특가 제보",
    content: "예시 글입니다. 구성/조건을 본문에 적고 원문 링크를 추가 정보에 넣어주세요.",
    createdAt: iso(55),
    authorName: "블루딜러-7777",
    extra: { category: "ssd", store: "예시몰", price: "99,000원", dealLink: "https://example.com" },
  },

  // 문의(통합)
  {
    id: "seed-inq-1",
    boardKey: "inquiry",
    type: "general",
    title: "(샘플) 가격현황 오탈자 제보",
    content: "GPU 가격현황에서 모델명이 일부 잘못 표시되는 것 같습니다.",
    createdAt: iso(40),
    authorName: "게스트",
    isPrivate: false,
    extra: { email: "" },
  },
  {
    id: "seed-inq-2",
    boardKey: "inquiry",
    type: "question",
    title: "(샘플) 문의 예시(공개)",
    content:
      "이 글은 문의 샘플입니다.\n\n- 문의 내용\n- 연락 이메일\n- 필요한 정보\n",
    createdAt: iso(20),
    authorName: "게스트",
    isPrivate: false,
    extra: { email: "" },
  },
];
