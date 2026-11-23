import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import { legacyAffiliateMappings, parseAffiliateMapping } from "../../../../../lib/affiliate";
import { importAffiliateMappings } from "../../../../../lib/affiliateStore";
import { verifyInternalBearer } from "../../../../../lib/internalAuth";
import { readJsonObject, RequestInputError } from "../../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (verifyInternalBearer(req.headers.get("authorization")) !== "ok" && !isAdminRequest(req)) return reply({ error: "Unauthorized" }, 401);

  try {
    const body = await readJsonObject(req, 262144);
    if (body.source === "legacy") {
      const mappings = legacyAffiliateMappings();
      if (!mappings.length) return reply({ error: "No validated legacy affiliate mappings" }, 409);
      const result = await importAffiliateMappings(mappings);
      return reply(result, "invalid" in result || result.conflicts ? 409 : 200);
    }

    if (!Array.isArray(body.mappings) || !body.mappings.length || body.mappings.length > 100) return reply({ error: "Expected up to 100 issued affiliate mappings" }, 400);
    const mappings = body.mappings.map(parseAffiliateMapping);
    if (mappings.some(mapping => !mapping)) return reply({ error: "Invalid issued affiliate mapping" }, 400);
    const result = await importAffiliateMappings(mappings.filter(mapping => mapping !== null));
    return reply(result, "invalid" in result || result.conflicts ? 409 : 200);
  } catch (error) {
    if (error instanceof RequestInputError) return reply({ error: error.message }, error.status);
    return reply({ error: "Affiliate storage request failed" }, 503);
  }
}
