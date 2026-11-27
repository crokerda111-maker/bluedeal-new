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
const { checkedOn: expansionCheckedOn, boards } = JSON.parse(await fs.readFile(path.join(root, 'src/content/products/motherboard-expansion.json'), 'utf8'));
const boardMedia = JSON.parse(await fs.readFile(path.join(root, 'src/content/products/motherboard-media.json'), 'utf8'));
for (const { ids, source: url, slots, newModel } of boards) {
  const source = { label: '메인보드 제조사 확장 사양', url, observedAt: `${expansionCheckedOn}T00:00:00+09:00`, kind: 'manufacturer-specifications' };
  if (newModel) {
    const [name, brand, socket, chipset, memory, formFactor, wifi] = newModel;
    base.products.push({
      id: ids[0], name, brand, category: 'motherboard', subtype: 'motherboard', kind: 'source-reviewed-model',
      features: [chipset, memory],
      specifications: [['CPU 소켓', socket], ['칩셋', chipset], ['메모리 규격', memory], ['규격', formFactor],
        ...(wifi ? [['무선랜', wifi]] : [])].map(([label, value]) => ({ label, value })),
      description: '제조사 자료에서 소켓과 메모리 규격, NVMe 슬롯 및 확장 조건을 확인한 메인보드입니다.',
      notes: ['CPU 지원표에서 정확한 모델과 필요한 BIOS 버전을 확인하세요.'],
      lifecycle: 'unknown', domesticState: 'unverified', manufacturerPartNumber: null, listObservedAt: null,
      sources: [source], strengths: [], issues: [], reviewSummary: null, reviewSources: [], listings: [],
      facts: wifi ? [{ key: 'wireless', value: 'present', source }] : [],
    });
  }
  for (const id of ids) {
    const product = base.products.find(item => item.id === id && item.category === 'motherboard');
    if (!product || !slots.length || product.facts?.some(fact => fact.key === 'nvmeSlots')) throw new Error('INVALID_MOTHERBOARD_EXPANSION_MODEL');
    const platform = product.specifications.find(spec => spec.label === '칩셋')?.value.match(/^(AMD|Intel)\b/)?.[1];
    if (!platform) throw new Error(`UNVERIFIED_MOTHERBOARD_PLATFORM ${id}`);
    product.facts = [...(product.facts ?? []), { key: 'nvmeSlots', value: String(slots.length), source }, { key: 'platform', value: platform, source }];
    if (!product.sources.some(item => item.url === url)) product.sources.push(source);
    const media = boardMedia[id];
    if (media?.white) {
      const colorSource = { ...source, label: '제조사 화이트 모델 자료', url: media.colorSource };
      product.facts.push({ key: 'boardColor', value: 'white', source: colorSource });
      if (!product.sources.some(item => item.url === colorSource.url)) product.sources.push(colorSource);
    }
  }
}
const retailPrices = await Promise.all(['ram','cpu','ssd','motherboard','gpu','cooler','psu','case','hdd','halfpc','fullpc','bundle'].map(key => fs.readFile(path.join(root,'src/content/prices',key+'.json'),'utf8').then(JSON.parse)));
base.products = linkDistributorOffers(base.products, retail.links, retailPrices);
const componentOffers = JSON.parse(await fs.readFile(path.join(root, 'src/content/products/component-verified-retail.json'), 'utf8'));
const outbound = JSON.parse(await fs.readFile(path.join(root, 'src/content/outbound.generated.json'), 'utf8'));
const listingOwners = new Map(base.products.flatMap(product => product.listings.map(listing => [listing.id, product.id])));
for (const { productId, listingId, checkedAt, source, seller } of componentOffers) {
  const product = base.products.find(item => item.id === productId);
  const offer = retailPrices.find(payload => payload.category === product?.category)?.items.find(item => item.id === listingId);
  const merchantLink = outbound[offer?.goCode];
  const owner = listingOwners.get(listingId);
  if (!product || !offer || offer.seller !== seller || offer.source !== 'G마켓' ||
      merchantLink?.merchant !== 'gmarket' || merchantLink.originalUrl !== source.url ||
      !Number.isFinite(Date.parse(checkedAt)) || !(Date.parse(offer.checkedAt) >= Date.parse(checkedAt)) ||
      (owner && owner !== productId)) {
    throw new Error(`INVALID_COMPONENT_RETAIL_LINK ${listingId}`);
  }
  if (!owner) {
    product.listings.push({ id: listingId, merchant: offer.source, seller, pricePage: `/prices/${product.category}#${listingId}` });
    listingOwners.set(listingId, productId);
  }
  product.domesticState = 'listing-observed';
  if (!product.sources.some(item => item.url === source.url)) product.sources.push(source);
}
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
