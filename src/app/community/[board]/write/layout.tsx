import { redirect } from "next/navigation";
import CommunityPolicyNotice from "../../../../components/CommunityPolicyNotice";
import MemberWriteGate from "../../../../components/MemberWriteGate";
import { memberWritingEnabled } from "../../../../lib/memberWrite";
import { pageMetadata } from "../../../../lib/site";

export const metadata = pageMetadata("게시글 작성 | BLUEDEAL", "커뮤니티 게시글 작성", undefined, true);

export default async function WriteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ board: string }> }) {
  const { board } = await params;
  if (board === "issue") redirect("/community/issue");
  return (
    <div className="space-y-3">
      <CommunityPolicyNotice />
      <MemberWriteGate enabled={memberWritingEnabled()} nextPath={"/community/" + board + "/write"}>{children}</MemberWriteGate>
    </div>
  );
}
