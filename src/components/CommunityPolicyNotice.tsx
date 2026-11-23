import Link from "next/link";

export default function CommunityPolicyNotice() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 text-sm leading-6 text-white/80">
      <span>광고성 게시글·개인 제휴 링크·도배를 금지합니다.</span>
      <Link href="/community-policy" prefetch={false} className="inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300">
        커뮤니티 운영정책
      </Link>
    </p>
  );
}
