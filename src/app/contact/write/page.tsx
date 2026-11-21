import { Suspense } from "react";
import ContactWriteClient from "./ContactWriteClient";
import { getCatalogProduct } from "../../../lib/catalogData";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string | string[]; product?: string | string[] }> }) {
  const query = await searchParams;
  const product = query.from === "products" && typeof query.product === "string" ? getCatalogProduct(query.product) : undefined;
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>로딩 중…</div>}>
      <ContactWriteClient productContext={product ? { id: product.id, name: product.name, referenceCode: product.referenceCode } : undefined} />
    </Suspense>
  );
}
