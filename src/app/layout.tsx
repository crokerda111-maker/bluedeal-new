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
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
