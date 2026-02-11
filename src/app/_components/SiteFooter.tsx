import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
        <div>© {new Date().getFullYear()} BLUEDEAL</div>

        <div className="flex flex-wrap items-center gap-4">
          <Link className="hover:text-white" href="/it">
            IT 소식
          </Link>
          <Link className="hover:text-white" href="/community">
            커뮤니티
          </Link>
          <Link className="hover:text-white" href="/prices">
            가격현황
          </Link>
          <Link className="hover:text-white" href="/hot">
            핫딜
          </Link>
          <Link className="hover:text-white" href="/contact">
            문의
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-6xl px-4 text-[12px] text-white/45">
        일부 링크는 제휴 링크일 수 있으며, 구매가 발생하면 일정 수수료를 받을 수 있습니다. 
      </div>
    </footer>
  );
}
