import { loadHomeFeed } from "../../../lib/homeFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await loadHomeFeed(), { headers: { "Cache-Control": "no-store" } });
}
