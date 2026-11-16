import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { deleteAdminBlogPost, getHybridBlogPost, saveAdminBlogPost } from "../../../../lib/blogStorage";
import { KvNotConfiguredError } from "../../../../lib/kvRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const post = await getHybridBlogPost(slug, isAdminRequest(req));
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const { slug } = await context.params;
    const post = await saveAdminBlogPost(body, slug);
    return NextResponse.json({ post });
  } catch (error: any) {
    if (error instanceof KvNotConfiguredError) {
      return NextResponse.json({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message ?? "글을 수정하지 못했습니다." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const { slug } = await context.params;
    const deleted = await deleteAdminBlogPost(slug);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof KvNotConfiguredError) {
      return NextResponse.json({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return NextResponse.json({ error: error?.message ?? "글을 삭제하지 못했습니다." }, { status: 500 });
  }
}

