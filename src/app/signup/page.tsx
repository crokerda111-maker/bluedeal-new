import MemberPage from "../_components/MemberPage";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("회원가입 | BLUEDEAL", "블루딜 회원 계정", undefined, true);

export default function Page({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  return <MemberPage mode="signup" searchParams={searchParams} />;
}
