import data from "../content/products/editorial.json";

export type ProductPhoto = {
  src: string;
  alt: string;
  source: string;
  sourceLabel: string;
};

type ProductEditorial = {
  catalogIds?: string[];
  partNames?: string[];
  photo?: ProductPhoto;
  advantage: string;
  caution: string;
  source: string;
  issue?: { text: string; source: string };
};

const byCatalogId = new Map<string, ProductEditorial>();
const byPartName = new Map<string, ProductEditorial>();

for (const entry of data.entries as ProductEditorial[]) {
  for (const id of entry.catalogIds ?? []) byCatalogId.set(id, entry);
  for (const name of entry.partNames ?? []) byPartName.set(name, entry);
}

export const productEditorialCheckedOn = data.checkedOn;

export function getProductEditorial(id: string) {
  return byCatalogId.get(id);
}

export function getPartEditorial(name: string) {
  return byPartName.get(name);
}
