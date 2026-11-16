import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type { MetaPayload, PricesPayload } from "./mockPrices";
import type { OutboundLink } from "./outbound";

export type PriceSnapshotContract = { schemaVersion: number; encoding: string; categories: string[]; itemFields: string[] };

function scalar(value: unknown): string[] {
  if (value === null || value === undefined) return ["z"];
  if (typeof value === "string") return ["s", value];
  if (typeof value === "boolean") return ["b", value ? "1" : "0"];
  if (typeof value === "number" && Number.isFinite(value)) {
    // JSON number spellings differ between Python and JavaScript (1.0 / 1).
    // The exact IEEE-754 value keeps this fingerprint lossless in both runtimes.
    const bytes = Buffer.alloc(8);
    bytes.writeDoubleBE(value === 0 ? 0 : value);
    return ["n", bytes.toString("hex")];
  }
  throw new Error("INVALID_PRICE_SNAPSHOT_SCALAR");
}

export function getPublicPriceSnapshot(meta: MetaPayload, categories: PricesPayload[], outbound: Record<string, OutboundLink>, contract: PriceSnapshotContract) {
  if (contract.schemaVersion !== 1 || contract.encoding !== "typed-ieee754-v1") throw new Error("UNSUPPORTED_PRICE_SNAPSHOT");
  if (new Set(contract.categories).size !== contract.categories.length) throw new Error("INVALID_PRICE_SNAPSHOT_CATEGORIES");
  const ordered = contract.categories.map(key => {
    const matches = categories.filter(category => category.category === key);
    if (matches.length !== 1) throw new Error("INVALID_PRICE_SNAPSHOT_CATEGORIES");
    return matches[0];
  });
  if (ordered.length !== categories.length) throw new Error("INVALID_PRICE_SNAPSHOT_CATEGORIES");
  const canonical = [
    contract.schemaVersion,
    [meta.updatedAt, meta.generatedAt, meta.schedule, meta.note].map(scalar),
    ordered.map(category => [
      scalar(category.category), scalar(category.updatedAt), scalar(category.generatedAt),
      [...category.items].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        .map(item => contract.itemFields.map(field => scalar((item as unknown as Record<string, unknown>)[field]))),
    ]),
    Object.keys(outbound).sort().map(code => [code, outbound[code].code, outbound[code].merchant, outbound[code].originalUrl].map(scalar)),
  ];
  return {
    service: "BLUEDEAL",
    schemaVersion: contract.schemaVersion,
    snapshotHash: createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex"),
    updatedAt: meta.updatedAt,
    generatedAt: meta.generatedAt ?? null,
    schedule: meta.schedule,
    itemCount: ordered.reduce((count, category) => count + category.items.length, 0),
    categories: ordered.map(category => ({ category: category.category, itemCount: category.items.length, updatedAt: category.updatedAt })),
  };
}
