const fields = new Set(['features', 'specifications', 'facts', 'sources', 'notes', 'strengths']);
const categories = new Set(['cpu','motherboard','ram','gpu','ssd','hdd','psu','case','cooler','fullpc','halfpc','bundle']);
function evidence(source, now) {
  const url = new URL(source.url); const observed = Date.parse(source.observedAt);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /(?:token|password|secret|affiliate|affid)=/i.test(url.search) || !source.label?.trim() || !Number.isFinite(observed) || observed > now) throw new Error('INVALID_DISTRIBUTOR_EVIDENCE');
}
function content(row, now) {
  for (const field of fields) if (row[field] !== undefined && !Array.isArray(row[field])) throw new Error('INVALID_DISTRIBUTOR_FIELD');
  if (!row.sources?.length) throw new Error('MISSING_DISTRIBUTOR_EVIDENCE');
  for (const source of row.sources) evidence(source, now);
  for (const fact of row.facts ?? []) {
    if (!fact.key || typeof fact.value !== 'string' || !fact.value.trim()) throw new Error('INVALID_DISTRIBUTOR_FACT');
    evidence(fact.source, now);
  }
  for (const strength of row.strengths ?? []) {
    if (!strength.sources?.length) throw new Error('MISSING_DISTRIBUTOR_EVIDENCE');
    for (const source of strength.sources) evidence(source, now);
  }
}

/** Apply reviewed identities; preserved merchant prices and links are never writable here. */
export function applyDistributorReview(products, review, now=Date.now()) {
  if (review.schemaVersion !== 1) throw new Error('INVALID_DISTRIBUTOR_REVIEW_VERSION');
  const result = structuredClone(products); const ids = new Set(result.map(p=>p.id)); const patched = new Set();
  for (const patch of review.enrichments) {
    const product = result.find(p=>p.id===patch.id);
    if (!product || patched.has(patch.id)) throw new Error('INVALID_DISTRIBUTOR_MATCH');
    patched.add(patch.id); content(patch,now);
    for (const [key,value] of Object.entries(patch)) {
      if (key==='id') continue;
      if (!fields.has(key) || !Array.isArray(value)) throw new Error('UNSAFE_DISTRIBUTOR_PATCH');
      product[key]=[...new Map([...(product[key]??[]),...value].map(item=>[typeof item==='string'?item:JSON.stringify(item),item])).values()];
    }
  }
  const allowed = new Set(['id','name','category','brand','subtype','kind','description','lifecycle','domesticState','manufacturerPartNumber','listObservedAt','issues','reviewSummary','reviewSources','listings',...fields]);
  for (const product of review.additions) {
    if (!/^distributor-[a-z]+-\d+$/.test(product.id) || ids.has(product.id) || !categories.has(product.category) || product.kind!=='model' || product.lifecycle!=='unknown' || product.domesticState!=='unverified' || product.manufacturerPartNumber!==null || product.listings.length || product.reviewSummary!==null || product.reviewSources.length || product.issues.length || Object.keys(product).some(key=>!allowed.has(key))) throw new Error('INVALID_DISTRIBUTOR_ADDITION');
    content(product,now);ids.add(product.id);result.push(structuredClone(product));
  }
  return result;
}
