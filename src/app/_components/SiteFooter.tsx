import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} BLUEDEAL <span aria-hidden="true">·</span> <Link href="/" prefetch={false} className="inline-flex min-h-11 items-center hover:text-white">bluedeal.co.kr</Link></div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
          <Link prefetch={false} className="hover:text-white" href="/about">블루딜 소개</Link>
          <Link prefetch={false} className="hover:text-white" href="/about#operation">운영 안내</Link>
          <Link prefetch={false} className="hover:text-white" href="/community-policy">커뮤니티 운영정책</Link>
          <Link prefetch={false} className="hover:text-white" href="/privacy">개인정보처리방침</Link>
          <Link prefetch={false} className="hover:text-white" href="/about#affiliate">제휴 안내</Link>
          <Link prefetch={false} className="hover:text-white" href="/it">
            IT 소식
          </Link>
          <Link prefetch={false} className="hover:text-white" href="/community">
            커뮤니티
          </Link>
          <Link prefetch={false} className="hover:text-white" href="/prices">
            상품·가격비교
          </Link>
          <Link prefetch={false} className="hover:text-white" href="/community/hotdeal">
            핫딜
          </Link>
          <Link prefetch={false} className="hover:text-white" href="/contact/write?vis=private">
            비공개 문의
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-4 text-[12px] text-white/70">
        일부 링크는 제휴 링크일 수 있으며, 구매가 발생하면 일정 수수료를 받을 수 있습니다. 
      </div>
    </footer>
  );
}
