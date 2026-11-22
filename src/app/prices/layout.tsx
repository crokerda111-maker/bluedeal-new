import PriceCategoryNav from "../../components/PriceCategoryNav";

export const metadata = {
  title: "상품·가격비교 | BLUEDEAL",
  description: "PC 부품·본체 상품과 확인 시점 가격 비교",
};

export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PriceCategoryNav />

      {children}
    </div>
  );
}
