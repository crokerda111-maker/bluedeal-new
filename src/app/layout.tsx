import "./globals.css";
import SiteHeader from "./_components/SiteHeader";
import SiteFooter from "./_components/SiteFooter";

export const metadata = {
  title: "BLUEDEAL",
  description: "IT 소식 · 커뮤니티 · 가격현황 · 핫딜",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#060B1A] text-white">
        {/* Background (restore original BLUEDEAL look) */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/18 blur-[110px]" />
          <div className="absolute top-52 left-[-160px] h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[95px]" />
          <div className="absolute bottom-[-220px] right-[-160px] h-[560px] w-[560px] rounded-full bg-indigo-500/14 blur-[120px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.12),transparent_60%)]" />
	          {/* grid (restore the original BLUEDEAL dark-blue + grid feel) */}
	          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(to_right,rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.22)_1px,transparent_1px)] [background-size:80px_80px]" />
        </div>

        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
