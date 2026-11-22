import { permanentRedirect } from "next/navigation";
import { legacyProductsHref, type SearchQuery } from "../../lib/productFilters";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchQuery> }) {
  permanentRedirect(legacyProductsHref(await searchParams));
}
