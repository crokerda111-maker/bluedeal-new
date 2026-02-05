import "./globals.css";

export const metadata = {
  title: "BLUEDEAL",
  description: "IT 소식 · 커뮤니티 · 가격현황 · 핫딜",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
