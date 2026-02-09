import { NextRequest, NextResponse } from "next/server";
import { getOnlinePostById } from "../../../../lib/onlinePosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  try {
    const post = await getOnlinePostById(id);
    if (!post) return json({ error: "Not found" }, { status: 404 });
    return json({ post });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load post";
    const status = msg.includes("Missing KV config") ? 503 : 500;
    return json({ error: msg }, { status });
  }
}
