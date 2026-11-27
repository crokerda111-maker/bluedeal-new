import { notFound } from "next/navigation";
import { getCommunityBoard } from "../../../../lib/boardConfig";
import { getPublicPostDetail } from "../../../../lib/postPage";
import CommunityPost from "./PostDetail";

export default async function CommunityPostPage({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board: slug, id } = await params;
  const board = getCommunityBoard(slug);
  if (!board) notFound();
  const post = await getPublicPostDetail(id, board.key);
  return <CommunityPost key={`${slug}:${id}`} boardSlug={slug} postId={id} initialPost={post} />;
}
