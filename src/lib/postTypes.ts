export type PostType =
  | "general"
  | "question"
  | "tip"
  // 리뷰 전용 말머리
  | "monitor"
  | "sound"
  | "parts"
  | "kbdmouse";

/** IT 소식(통합) */
export type ITBoardKey = "it";

/** 커뮤니티 게시판 */
export type CommunityBoardKey =
  | "review"
  | "hardware"
  | "overclock"
  | "issue"
  | "resources"
  | "hotdeal";

/** 문의(통합: 공개/비공개는 글 단위로 선택) */
export type InquiryBoardKey = "inquiry";

export type BoardKey = ITBoardKey | CommunityBoardKey | InquiryBoardKey;
export type BoardGroup = "it" | "community" | "inquiry";

export type InquiryVisibility = "public" | "private";

export type PostExtra = Record<string, string | number | boolean | null | undefined>;

/**
 * 게시물 모델
 * - 목록에서는 비공개 글의 content/extra가 비어있을 수 있습니다.
 */
export type Post = {
  id: string;
  boardKey: BoardKey;

  /** 말머리 */
  type: PostType;

  title: string;
  content: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO

  /** 작성자(회원 닉네임) */
  authorName?: string;

  /** 비공개(문의 등) */
  isPrivate?: boolean;
  passwordHash?: string;

  /** 게시판별 추가 필드 */
  extra?: PostExtra;
};
