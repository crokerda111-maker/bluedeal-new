import type { Post } from "./postTypes";

export const POST_LIMITS = {
  bodyBytes: 128 * 1024,
  title: 200,
  content: 30_000,
  authorName: 20,
  password: 256,
  extraKeys: 32,
  extraKey: 64,
  extraValue: 4_000,
} as const;

export class PostValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PostValidationError"; }
}

type EditableFields = {
  title?: unknown; content?: unknown; authorName?: unknown; password?: unknown;
  isPrivate?: unknown; lockToAdminPassword?: unknown; extra?: unknown;
};

export function validatePostFields(input: EditableFields, options: { partial?: boolean; current?: Post } = {}): void {
  for (const field of ["title", "content"] as const) {
    const value = input[field];
    if (options.partial && value === undefined) continue;
    const label = field === "title" ? "제목" : "내용";
    if (typeof value !== "string" || !value.trim()) throw new PostValidationError(`${label}을 입력하세요.`);
    // Preserve unchanged historical content, without truncating it during an unrelated edit.
    if (value !== options.current?.[field] && value.trim().length > POST_LIMITS[field]) {
      throw new PostValidationError(`${label}은 ${POST_LIMITS[field].toLocaleString("ko-KR")}자 이내로 입력하세요.`);
    }
  }
  if (input.authorName !== undefined && input.authorName !== null &&
      (typeof input.authorName !== "string" || (input.authorName !== options.current?.authorName && input.authorName.trim().length > POST_LIMITS.authorName))) {
    throw new PostValidationError(`닉네임은 ${POST_LIMITS.authorName}자 이내로 입력하세요.`);
  }
  if (input.password !== undefined && input.password !== null && (typeof input.password !== "string" || input.password.length > POST_LIMITS.password)) {
    throw new PostValidationError(`비밀번호는 ${POST_LIMITS.password}자 이내로 입력하세요.`);
  }
  for (const field of ["isPrivate", "lockToAdminPassword"] as const) {
    if (input[field] !== undefined && typeof input[field] !== "boolean") throw new PostValidationError("공개 여부를 다시 선택해 주세요.");
  }
  if (input.extra !== undefined && input.extra !== null) {
    if (typeof input.extra !== "object" || Array.isArray(input.extra)) throw new PostValidationError("추가정보는 항목과 값으로 입력해 주세요.");
    const entries = Object.entries(input.extra);
    if (entries.length > POST_LIMITS.extraKeys) throw new PostValidationError(`추가정보는 ${POST_LIMITS.extraKeys}개 항목까지 입력할 수 있습니다.`);
    for (const [key, value] of entries) {
      if (!key || key.length > POST_LIMITS.extraKey || ["__proto__", "prototype", "constructor"].includes(key)) throw new PostValidationError("추가정보의 항목 이름을 확인해 주세요.");
      if (value !== undefined && value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        throw new PostValidationError("추가정보 값에는 글자·숫자·참/거짓만 입력할 수 있습니다.");
      }
      if ((typeof value === "string" && value.length > POST_LIMITS.extraValue) || (typeof value === "number" && !Number.isFinite(value))) {
        throw new PostValidationError(`추가정보 값은 ${POST_LIMITS.extraValue.toLocaleString("ko-KR")}자 이내로 입력하세요.`);
      }
    }
  }
}
