import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../lib/adminAuth";
import { listHybridBlogPosts, saveAdminBlogPost } from "../../../lib/blogStorage";
import { KvNotConfiguredError } from "../../../lib/kvRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = isAdminRequest(req);
  try {
    const result = await listHybridBlogPosts({ includeDrafts: admin, limit: 200 });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "블로그 글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const post = await saveAdminBlogPost(body);
    return NextResponse.json({ post }, { status: 201 });
  } catch (error: any) {
    if (error instanceof KvNotConfiguredError) {
      return NextResponse.json({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message ?? "글을 저장하지 못했습니다." }, { status: 400 });
  }
}

