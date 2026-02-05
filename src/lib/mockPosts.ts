import type { Post } from "./postTypes";

const now = new Date();
const iso = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();

export const MOCK_POSTS: Post[] = [
  {
    id: "seed-review-1",
    boardKey: "review",
    type: "general",
    title: "(샘플) DDR5 6000 CL30 메모리 실사용 후기",
    content:
      "게임/작업에서 체감은 크지 않지만, 안정화/호환성 체크 포인트를 정리했습니다.\n\n- XMP/EXPO 적용\n- 전압/온도\n- 호환성(보드 QVL)\n",
    createdAt: iso(60 * 12),
    extra: {
      product: "DDR5 32GB(16x2) 6000 CL30",
      rating: "4",
      pros: "호환성 좋음, 성능/가격 밸런스",
      cons: "RGB는 취향",
    },
  },
  {
    id: "seed-hardware-1",
    boardKey: "hardware",
    type: "question",
    title: "(샘플) B650 보드 추천 부탁",
    content:
      "AM5로 넘어가려고 하는데, B650 보드 중 전원부/확장성 무난한 제품 추천 부탁합니다.\n\n- 예산: 25~30\n- 용도: QHD 144Hz 게임\n",
    createdAt: iso(60 * 6),
    extra: { part: "motherboard", budget: "30만원", usage: "QHD 144Hz" },
  },
  {
    id: "seed-oc-1",
    boardKey: "overclock",
    type: "tip",
    title: "(샘플) 7800X3D PBO -20 세팅 공유",
    content:
      "PBO + Curve Optimizer로 전력/온도 줄이면서 프레임 유지한 세팅입니다.\n\n- CO: -20\n- PPT/TDC/EDC: Auto\n- 테스트: OCCT 30m\n",
    createdAt: iso(60 * 3),
    extra: { target: "cpu", setting: "CO -20", stability: "OCCT 30m", temp: "max 78°C" },
  },
  {
    id: "seed-res-1",
    boardKey: "resources",
    type: "general",
    title: "(샘플) 드라이버/유틸 모음 링크",
    content:
      "자주 쓰는 유틸/공식 드라이버 링크 모음입니다. 자료는 가능한 공식 배포처만 공유해주세요.",
    createdAt: iso(60 * 2),
    extra: { kind: "utility", link: "https://example.com", license: "공식 배포처" },
  },
  {
    id: "seed-inq-public-1",
    boardKey: "inquiry_public",
    type: "general",
    title: "(샘플) 가격현황 오탈자 제보",
    content: "GPU 가격현황에서 모델명이 일부 잘못 표시되는 것 같습니다.",
    createdAt: iso(60 * 1),
    extra: { email: "" },
  },
  {
    id: "seed-inq-private-1",
    boardKey: "inquiry_private",
    type: "question",
    title: "(샘플) 비공개 문의 예시",
    content: "이 글은 비공개 문의 게시판 샘플입니다. 실제 글은 비밀번호로 잠깁니다.",
    createdAt: iso(30),
    isPrivate: true,
    passwordHash: "",
  },
];
