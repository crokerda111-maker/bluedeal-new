import { NextRequest, NextResponse } from "next/server";
import { detectMerchant, normalizeOutboundUrl, resolveAffiliateUrl } from "../../../../../lib/affiliate";
import { getStoredAffiliateMappings } from "../../../../../lib/affiliateStore";
import { verifyInternalBearer } from "../../../../../lib/internalAuth";
import { KvNotConfiguredError } from "../../../../../lib/kvRest";
import { createOrReuseOutboundCode } from "../../../../../lib/onlineOutbound";
import { readJsonObject, RequestInputError } from "../../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(req: NextRequest) {
  const auth = verifyInternalBearer(req.headers.get("authorization"));
  if (auth === "not-configured") {
    return json({ error: "OUTBOUND_INGEST_SECRET is not configured." }, { status: 503 });
  }
  if (auth !== "ok") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readJsonObject(req, 8192);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ errorCode: error.code, error: error.message }, { status: error.status });
    return json({ error: "입력한 내용을 확인해 주세요." }, { status: 400 });
  }

  const rawUrl =
    body && typeof body === "object" && typeof (body as { url?: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";

  if (!rawUrl) return json({ error: "Missing url" }, { status: 400 });
  if (rawUrl.length > 4096) return json({ error: "URL is too long." }, { status: 400 });

  const normalizedUrl = normalizeOutboundUrl(rawUrl);
  if (!normalizedUrl) {
    return json({ error: "Unsupported or invalid product URL." }, { status: 400 });
  }

  const merchant = detectMerchant(new URL(normalizedUrl).hostname);
  if (!merchant) {
    return json({ error: "Unsupported merchant." }, { status: 400 });
  }

  try {
    const code = await createOrReuseOutboundCode(normalizedUrl);
    if (!code) {
      return json({ error: "Could not register outbound URL." }, { status: 400 });
    }

    const stored = await getStoredAffiliateMappings([normalizedUrl]);
    const resolution = resolveAffiliateUrl({ merchant, originalUrl: normalizedUrl, code }, stored.get(normalizedUrl));
    return json(
      {
        code,
        goUrl: new URL(`/go/${code}`, req.nextUrl.origin).toString(),
        merchant,
        normalizedUrl,
        affiliateMode: resolution?.mode ?? "blocked",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof KvNotConfiguredError) {
      return json({ errorCode: error.code, error: "KV storage is not configured." }, { status: 503 });
    }

    return json({ error: "Failed to register outbound URL." }, { status: 500 });
  }
}
