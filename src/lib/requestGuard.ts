export class RequestInputError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RequestInputError";
    this.status = status;
    this.code = code;
  }
}

/** Browser mutations must come from the page's own origin. Server clients may omit Origin. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestInputError(403, "FORBIDDEN_ORIGIN", "다른 사이트에서 보낸 요청은 처리할 수 없습니다.");
  }
  if (!origin) return;
  let allowed = false;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    // Next.js may normalize a loopback hostname. Preserve the actual incoming Host.
    allowed = source.origin === origin && source.protocol === target.protocol && source.host === (request.headers.get("host") ?? target.host);
  } catch { /* Reject malformed and opaque origins. */ }
  if (!allowed) throw new RequestInputError(403, "FORBIDDEN_ORIGIN", "다른 사이트에서 보낸 요청은 처리할 수 없습니다.");
}

/** Count streamed UTF-8 bytes, even when Content-Length is missing or incorrect. */
export async function readJsonObject(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  assertSameOrigin(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestInputError(415, "JSON_REQUIRED", "JSON 형식으로 요청해 주세요.");
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    throw new RequestInputError(400, "INVALID_BODY_LENGTH", "요청 크기를 확인할 수 없습니다.");
  }
  if (declared !== null && Number(declared) > maxBytes) {
    throw new RequestInputError(413, "BODY_TOO_LARGE", "입력한 내용이 너무 큽니다. 내용을 줄여 주세요.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestInputError(400, "INVALID_JSON", "입력한 내용을 확인해 주세요.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestInputError(413, "BODY_TOO_LARGE", "입력한 내용이 너무 큽니다. 내용을 줄여 주세요.");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RequestInputError(400, "JSON_OBJECT_REQUIRED", "입력한 내용을 확인해 주세요.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestInputError) throw error;
    throw new RequestInputError(400, "INVALID_JSON", "입력한 내용을 확인해 주세요.");
  } finally { reader.releaseLock(); }
}
