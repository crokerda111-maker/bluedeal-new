import MemberWriteGate from "../../../components/MemberWriteGate";
import { memberWritingEnabled } from "../../../lib/memberWrite";
import { pageMetadata } from "../../../lib/site";

export const metadata = pageMetadata("IT 소식 작성 | BLUEDEAL", "게시글 작성", undefined, true);

export default function WriteLayout({ children }: { children: React.ReactNode }) {
  return <MemberWriteGate enabled={memberWritingEnabled()} nextPath="/it/write">{children}</MemberWriteGate>;
}
