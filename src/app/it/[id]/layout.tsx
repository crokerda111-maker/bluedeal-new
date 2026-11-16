import { notFound } from "next/navigation";
import { getPostPageInfo, postPageMetadata } from "../../../lib/postPage";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

async function requirePost(params: Props["params"]) {
  const post = await getPostPageInfo((await params).id, "it");
  if (!post) notFound();
  return post;
}

export async function generateMetadata({ params }: Props) {
  const post = await requirePost(params);
  return postPageMetadata(post, "IT 소식", `/it/${post.id}`);
}

export default async function PostLayout({ children, params }: Props) {
  await requirePost(params);
  return children;
}
