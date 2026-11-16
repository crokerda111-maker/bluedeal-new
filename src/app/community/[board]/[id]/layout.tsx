import { notFound } from "next/navigation";
import { getCommunityBoard } from "../../../../lib/boardConfig";
import { getPostPageInfo, postPageMetadata } from "../../../../lib/postPage";

type Props = { children: React.ReactNode; params: Promise<{ board: string; id: string }> };

async function requirePost(params: Props["params"]) {
  const { board: slug, id } = await params;
  const board = getCommunityBoard(slug);
  if (!board) notFound();
  const post = await getPostPageInfo(id, board.key);
  if (!post) notFound();
  return { board, post };
}

export async function generateMetadata({ params }: Props) {
  const { board, post } = await requirePost(params);
  return postPageMetadata(post, board.title, `/community/${board.slug}/${post.id}`);
}

export default async function PostLayout({ children, params }: Props) {
  await requirePost(params);
  return children;
}
