import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { applyDistributorReview, linkDistributorOffers } from './distributor-review.mjs';
import { reviewBoardSpecifications, reviewCpuSpecifications, reviewModelSpecifications } from './reviewed-specifications.mjs';
import { PART_DOSSIERS } from '../../src/content/partDossiers.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = JSON.parse(await fs.readFile(path.join(root, 'ops/private/catalog/public-catalog.base.local.json'), 'utf8'));
const reviewed = (await Promise.all(['reviewed-models.json', 'reviewed-psus.json', 'reviewed-cpus.json', 'reviewed-ram.json', 'reviewed-ssds.json', 'reviewed-ssd-specifications.json', 'reviewed-gpus.json', 'reviewed-cooling.json', 'reviewed-cases.json', 'reviewed-systems.json', 'reviewed-mixed.json', 'reviewed-hdds.json'].map(file => fs.readFile(path.join(root, 'src/content/products', file), 'utf8').then(JSON.parse)))).flat();
const claimedListings = new Set(reviewed.flatMap(product => product.listings.map(listing => listing.id)));
base.products = base.products.filter(product => !product.listings.length || !product.listings.every(listing => claimedListings.has(listing.id)));
for (const product of reviewed) {
  if (base.products.some(existing => existing.id === product.id)) throw new Error('REVIEWED_PRODUCT_ID_CONFLICT');
  base.products.push(product);
}
for (const dossier of PART_DOSSIERS) {
  const existing = base.products.find(p => p.id === dossier.skuId || p.id === `curated-${dossier.skuId}`);
  const references = [...dossier.strengths.flatMap(s => s.sources), ...dossier.findings.flatMap(f => f.sources)];
  const sources = [...new Map(references.map(s => [s.url, { label: s.label, url: s.url, observedAt: s.checkedAt, kind: 'manufacturer-support' }])).values()];
  const product = existing ?? { id: dossier.skuId, name: dossier.name, category: dossier.slot, subtype: dossier.slot,
    brand: dossier.name.startsWith('Intel ') ? 'Intel' : '확인 필요', kind: 'source-reviewed-model', features: [], specifications: [],
    description: '공식 사양과 제조사 공지를 확인한 부품입니다. 독립 성능·후기 검토와 현재 판매 조건은 추가 확인이 필요합니다.',
    notes: [], lifecycle: 'unknown', domesticState: 'unverified', manufacturerPartNumber: null,
    sources: [], listObservedAt: null, strengths: [], issues: [], reviewSummary: null, reviewSources: [], listings: [] };
  product.strengths = dossier.strengths.map(s => ({ title: s.title, detail: s.detail, conditions: s.conditions, sources: s.sources.map(source => ({ label: source.label, url: source.url, observedAt: source.checkedAt, kind: 'manufacturer-support' })) }));
  if (!product.features.length) product.features = dossier.strengths.map(strength => strength.title);
  product.issues = dossier.findings.map(f => ({ title: f.title, summary: f.summary, conditions: f.conditions, action: f.action, sources: f.sources.map(source => ({ label: source.label, url: source.url, observedAt: source.checkedAt, kind: 'manufacturer-support' })) }));
  product.sources = [...new Map([...product.sources, ...sources].map(s => [s.url, s])).values()];
  if (!existing) base.products.push(product);
}
// Apply explicitly reviewed distributor matches only; never fuzzy-merge options or prices.
const distributor = JSON.parse(await fs.readFile(path.join(root, 'src/content/products/distributor-reviewed.json'), 'utf8'));
base.products = applyDistributorReview(base.products, distributor);
const retail = JSON.parse(await fs.readFile(path.join(root, 'src/content/products/distributor-retail-reviewed.json'), 'utf8'));
base.products = applyDistributorReview(base.products, retail);
const [cpuSpecs, boardSpecs, modelSpecs] = await Promise.all(['cpu-specifications.json', 'motherboard-specifications.json', 'model-specifications.json'].map(file =>
  fs.readFile(path.join(root, 'src/content/products', file), 'utf8').then(JSON.parse)));
const enrichments = [...reviewCpuSpecifications(cpuSpecs), ...reviewBoardSpecifications(boardSpecs, base.products), ...reviewModelSpecifications(modelSpecs)];
const enrichedIds = new Set(enrichments.map(specification => specification.id));
base.products = applyDistributorReview(base.products, {
  schemaVersion: 1,
  enrichments,
  additions: [],
});
for (const product of base.products) {
  if (enrichedIds.has(product.id)) {
    product.sources = [...new Map(product.sources.map(source => [source.url, source])).values()];
  }
}
for (const filename of ['component-specifications-reviewed.json', 'component-specifications-manufacturer.json', 'case-classifications.json']) {
  const doc = JSON.parse(await fs.readFile(path.join(root, 'src/content/products', filename), 'utf8'));
  const additions = reviewModelSpecifications(doc);
  base.products = applyDistributorReview(base.products, { schemaVersion: 1, enrichments: additions, additions: [] });
  const updated = new Set(additions.map(row => row.id));
  for (const product of base.products) {
    if (updated.has(product.id)) {
      product.sources = [...new Map(product.sources.map(source => [source.url, source])).values()];
    }
  }
}
const retailPrices = await Promise.all(['ram','cpu','ssd','motherboard','gpu','cooler','psu','case','hdd','halfpc','fullpc','bundle'].map(key => fs.readFile(path.join(root,'src/content/prices',key+'.json'),'utf8').then(JSON.parse)));
base.products = linkDistributorOffers(base.products, retail.links, retailPrices);
base.products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'ko'));
const ids = new Set();
const referenceCodes = new Set();
for (const product of base.products) {
  if (!/^[a-z0-9-]+$/.test(product.id) || ids.has(product.id)) throw new Error('PUBLIC_PRODUCT_ID_CONFLICT');
  ids.add(product.id);
  product.referenceCode = `BD-${crypto.createHash('sha256').update(product.id).digest('hex').slice(0, 10).toUpperCase()}`;
  if (referenceCodes.has(product.referenceCode)) throw new Error('PUBLIC_REFERENCE_CODE_CONFLICT');
  referenceCodes.add(product.referenceCode);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(base.products)).digest('hex');
const payload = { schemaVersion: 1, catalogHash: hash, entries: base.products.length, products: base.products };
const destination = path.join(root, 'src/content/products/catalog.json');
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.writeFile(destination, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ entries: payload.entries, catalogHash: hash, freshPricesAdded: 0 }));
