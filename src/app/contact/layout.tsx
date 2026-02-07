export const metadata = {
  title: "문의 | BLUEDEAL",
  description: "문의 게시판",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
