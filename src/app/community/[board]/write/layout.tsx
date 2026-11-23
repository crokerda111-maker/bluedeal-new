import { redirect } from "next/navigation";
import { pageMetadata } from "../../../../lib/site";

export const metadata = pageMetadata("게시글 작성 | BLUEDEAL", "커뮤니티 게시글 작성", undefined, true);

export default async function WriteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ board: string }> }) {
  if ((await params).board === "issue") redirect("/community/issue");
  return children;
}
