export type PostType = "general" | "question" | "tip";

export type CommunityBoardKey = "review" | "hardware" | "overclock" | "resources";
export type InquiryVisibility = "public" | "private";
export type InquiryBoardKey = "inquiry_public" | "inquiry_private";

export type BoardKey = CommunityBoardKey | InquiryBoardKey;
export type BoardGroup = "community" | "inquiry";

export type PostExtra = Record<string, string | number | boolean | null | undefined>;

/**
 * MVP 게시물 모델
 * - 첫 단계: localStorage 기반(브라우저 단위)
 * - 다음 단계: VPS API/DB로 교체 가능하도록 형태를 단순하게 유지
 */
export type Post = {
  id: string;
  boardKey: BoardKey;
  /** 말머리: 일반/질문/팁 */
  type: PostType;
  title: string;
  content: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO

  authorName?: string;

  /** 문의(비공개)용 */
  isPrivate?: boolean;
  passwordHash?: string;

  /** 게시판별 추가 필드 */
  extra?: PostExtra;
};
