import "./globals.css";
import SiteHeader from "./_components/SiteHeader";
import SiteFooter from "./_components/SiteFooter";
import { pageMetadata, SITE_DESCRIPTION, SITE_URL } from "../lib/site";

export const metadata = {
  ...pageMetadata("블루딜 | PC 부품 가격·핫딜·IT 커뮤니티", SITE_DESCRIPTION),
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#060B1A] text-white">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-cyan-200 focus:px-4 focus:py-3 focus:text-slate-950">본문으로 바로가기</a>
        {/* Background (restore original BLUEDEAL look) */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/18 blur-[110px]" />
          <div className="absolute top-52 left-[-160px] h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[95px]" />
          <div className="absolute bottom-[-220px] right-[-160px] h-[560px] w-[560px] rounded-full bg-indigo-500/14 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.12),transparent_60%)]" />
	          {/* grid (slightly more visible) */}
	          <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(148,163,184,0.28)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.28)_1px,transparent_1px)] [background-size:80px_80px]" />
        </div>

        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 scroll-mt-32 px-4 py-8 md:scroll-mt-24">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
