import "./globals.css";

export const metadata = {
  title: "BLUEDEAL",
  description: "핫딜·리뷰·가이드 큐레이션",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
