import { notFound } from "next/navigation";
import { getPostPageInfo } from "../../../lib/postPage";

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

export default async function InquiryLayout({ children, params }: Props) {
  const post = await getPostPageInfo((await params).id, "inquiry");
  if (!post) notFound();
  return children;
}
