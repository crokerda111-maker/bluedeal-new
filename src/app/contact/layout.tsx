import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("문의 | BLUEDEAL", "블루딜 문의 게시판", undefined, true);

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
