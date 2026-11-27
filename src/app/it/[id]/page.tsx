import { getPublicPostDetail } from "../../../lib/postPage";
import ITPost from "./PostDetail";

export default async function ITPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicPostDetail(id, "it");
  return <ITPost key={id} postId={id} initialPost={post} />;
}
