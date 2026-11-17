import type { PriceItem } from "../lib/mockPrices";
import type { PriceCategoryKey } from "../lib/priceCategories";
import { PRICE_SORTS, type PriceFilters } from "../lib/priceFilters";

const controlClass = "mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-[#0B1428] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";

export default function PriceFilterForm({ category, items, filters }: { category: PriceCategoryKey; items: PriceItem[]; filters: PriceFilters }) {
  const capacities = [...new Set(items.flatMap(item => item.capacityGB ? [item.capacityGB] : []))].sort((a, b) => a - b);
  if (filters.capacity && !capacities.includes(Number(filters.capacity))) capacities.push(Number(filters.capacity));
  capacities.sort((a, b) => a - b);
  return (
    <form key={JSON.stringify(filters)} action={`/prices/${category}`} method="get" className="bd-surface-md grid grid-cols-2 gap-3 p-4 lg:flex lg:flex-wrap lg:items-end" aria-label="상품 검색과 필터">
      <label className="col-span-2 min-w-0 flex-1 text-xs text-white/75 lg:col-span-1">
        상품 검색
        <input className={controlClass} type="search" name="q" defaultValue={filters.query} maxLength={100} aria-describedby="price-search-help" placeholder="제품명·모델·판매자" />
      </label>
      {category === "ram" ? (
        <label className="text-xs text-white/75">메모리 규격
          <select className={controlClass} name="memory" defaultValue={filters.memory}>
            <option value="">전체 규격</option><option value="DDR4">DDR4</option><option value="DDR5">DDR5</option>
          </select>
        </label>
      ) : null}
      {["ram", "ssd", "gpu"].includes(category) ? (
        <label className="text-xs text-white/75">{category === "ram" ? "키트 총용량" : category === "gpu" ? "그래픽 메모리" : "SSD 용량"}
          <select className={controlClass} name="capacity" defaultValue={filters.capacity}>
            <option value="">전체 용량</option>
            {capacities.map(capacity => <option key={capacity} value={capacity}>{category === "ssd" && capacity % 1000 === 0 ? `${capacity / 1000}TB` : `${capacity}GB`}</option>)}
          </select>
        </label>
      ) : null}
      {category === "ssd" ? (
        <label className="text-xs text-white/75">DRAM 캐시
          <select className={controlClass} name="dram" defaultValue={filters.dram}>
            <option value="">전체</option><option value="present">DRAM 있음</option><option value="absent">DRAM 없음</option><option value="unknown">미확인</option>
          </select>
        </label>
      ) : null}
      <label className="col-span-2 min-w-0 text-xs text-white/75 sm:col-span-1">정렬
        <select className={controlClass} name="sort" defaultValue={filters.sort}>
          {Object.entries(PRICE_SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <div className="col-span-2 flex items-center gap-3 lg:pb-0">
        <button type="submit" className="min-h-11 rounded-lg border border-cyan-300/30 bg-cyan-300/15 px-5 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">적용</button>
        <a className="px-2 py-3 text-sm text-white/75 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={`/prices/${category}`}>초기화</a>
      </div>
      <p id="price-search-help" className="col-span-2 w-full text-xs leading-relaxed text-white/65 lg:basis-full">단어를 띄어쓰면 모두 포함한 상품을 찾습니다.</p>
    </form>
  );
}
