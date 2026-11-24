import data from "../content/products/editorial.json";
import catalogCasePhotos from "../content/products/casePhotos.json";
import manufacturerCaseOptions from "../content/products/caseOptions.json";

export type ProductPhoto = {
  src: string;
  alt: string;
  source: string;
  sourceLabel: string;
  crop?: { x: number; y: number; size: number; mask?: string; background?: string };
};

export type CaseOption = {
  label: string;
  src: string;
  source: string;
  credit?: { source: string; label: string };
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

export function getProductPhoto(id: string) {
  const firstOption = getCaseOptions(id)?.[0];
  return firstOption ? getCaseOptionPhoto(firstOption) : byCatalogId.get(id)?.photo ?? (catalogCasePhotos as Record<string, ProductPhoto>)[id];
}

export function getCaseOptions(id: string) {
  return (manufacturerCaseOptions as Partial<Record<string, CaseOption[]>>)[id];
}

export function getCaseOptionPhoto(option: CaseOption): ProductPhoto {
  return {
    src: option.src,
    alt: `${option.label} 케이스 외관`,
    source: option.credit?.source ?? option.source,
    sourceLabel: option.credit?.label ?? "Fractal Design",
  };
}

export function getPartEditorial(name: string) {
  return byPartName.get(name);
}
