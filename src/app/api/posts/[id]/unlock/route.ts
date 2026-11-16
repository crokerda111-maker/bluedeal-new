import { NextRequest } from "next/server";
import { postJson, readAuthorizedPost } from "../../../../../lib/postAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const origin = req.headers.get("origin");
  // Next can normalize nextUrl's hostname (for example 127.0.0.1 to localhost).
  // Compare the browser's origin with the incoming HTTP host, including its port.
  if (origin) {
    let allowed = false;
    try {
      const source = new URL(origin);
      allowed = source.origin === origin && source.protocol === req.nextUrl.protocol && source.host === req.headers.get("host");
    } catch { /* Reject malformed or opaque origins. */ }
    if (!allowed) return postJson({ error: "Forbidden origin" }, { status: 403 });
  }
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return postJson({ error: "JSON body required" }, { status: 415 });
  const reader = req.body?.getReader();
  if (!reader) return postJson({ error: "Invalid JSON" }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  let body: unknown;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return postJson({ error: "Request body is too large" }, { status: 413 });
      }
      chunks.push(part.value);
    }
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    return postJson({ error: "Invalid JSON" }, { status: 400 });
  } finally { reader.releaseLock(); }
  const password = body && typeof body === "object" && "password" in body ? (body as { password?: unknown }).password : undefined;
  if (typeof password !== "string" || !password.trim()) return postJson({ error: "비밀번호를 입력하세요." }, { status: 400 });
  const { id } = await ctx.params;
  return readAuthorizedPost(req, id, password.trim());
}
