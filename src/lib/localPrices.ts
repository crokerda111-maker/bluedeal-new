import type { MetaPayload, PricesPayload } from "./mockPrices";
import type { PriceCategoryKey } from "./priceCategories";
import meta from "../content/prices/meta.json";
import ram from "../content/prices/ram.json";
import cpu from "../content/prices/cpu.json";
import ssd from "../content/prices/ssd.json";
import motherboard from "../content/prices/motherboard.json";
import gpu from "../content/prices/gpu.json";
import cooler from "../content/prices/cooler.json";
import halfpc from "../content/prices/halfpc.json";
import fullpc from "../content/prices/fullpc.json";
import psu from "../content/prices/psu.json";
import casePrices from "../content/prices/case.json";
import hdd from "../content/prices/hdd.json";
import bundle from "../content/prices/bundle.json";

const LOCAL_PRICES: Record<PriceCategoryKey, unknown> = {
  ram,
  cpu,
  ssd,
  motherboard,
  gpu,
  cooler,
  halfpc,
  fullpc,
  psu,
  case: casePrices,
  hdd,
  bundle,
};

export function getLocalMeta(): MetaPayload {
  return meta as MetaPayload;
}

export function getLocalPrices(category: PriceCategoryKey): PricesPayload {
  return LOCAL_PRICES[category] as PricesPayload;
}

