import PriceCategoryNav from "../../components/PriceCategoryNav";

export const metadata = {
  title: "가격현황 | BLUEDEAL",
  description: "PC 부품/본체 가격현황",
};

export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PriceCategoryNav />

      {children}
    </div>
  );
}
