import { CATALOG_HASH, CATALOG_SUMMARY } from "../../../../lib/catalogData";

export async function GET() {
  return Response.json({ schemaVersion: 1, catalogHash: CATALOG_HASH, ...CATALOG_SUMMARY }, { headers: { "Cache-Control": "public, max-age=60" } });
}
