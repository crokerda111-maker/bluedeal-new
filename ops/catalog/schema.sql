PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY CHECK(version = 1));
INSERT OR IGNORE INTO schema_version VALUES(1);

CREATE TABLE IF NOT EXISTS parts(
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  display_name TEXT NOT NULL,
  manufacturer TEXT,
  manufacturer_part_number TEXT,
  identity_state TEXT NOT NULL CHECK(identity_state IN ('curated-unverified', 'manufacturer-verified'))
);
CREATE TABLE IF NOT EXISTS variants(
  id TEXT PRIMARY KEY,
  part_id TEXT NOT NULL REFERENCES parts(id),
  revision TEXT,
  attributes_json TEXT NOT NULL,
  identity_state TEXT NOT NULL CHECK(identity_state IN ('curated-unverified', 'manufacturer-verified'))
);
CREATE TABLE IF NOT EXISTS listings(
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES variants(id),
  merchant TEXT NOT NULL,
  merchant_product_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  seller TEXT,
  verification_state TEXT NOT NULL CHECK(verification_state IN ('needs-merchant-verification', 'verified')),
  UNIQUE(merchant, merchant_product_id, variant_id)
);
CREATE TABLE IF NOT EXISTS evidence(
  id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  artifact_path TEXT,
  retrieved_at TEXT NOT NULL,
  source_observed_at TEXT,
  verified_at TEXT,
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS facts(
  variant_id TEXT NOT NULL REFERENCES variants(id),
  field TEXT NOT NULL,
  value_json TEXT NOT NULL,
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  verification_state TEXT NOT NULL CHECK(verification_state IN ('curated-unverified', 'source-verified', 'conflicting')),
  PRIMARY KEY(variant_id, field, evidence_id)
);
CREATE TABLE IF NOT EXISTS price_observations(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  observed_at TEXT NOT NULL,
  product_price_krw INTEGER CHECK(product_price_krw > 0),
  shipping_krw INTEGER CHECK(shipping_krw >= 0),
  availability TEXT NOT NULL CHECK(availability IN ('unknown', 'in-stock', 'sold-out')),
  selected_options_json TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK(verification_state IN ('pending', 'verified', 'rejected', 'historical'))
);
CREATE TABLE IF NOT EXISTS benefit_versions(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  rule_json TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK(verification_state IN ('pending', 'verified', 'rejected'))
);
CREATE TABLE IF NOT EXISTS affiliate_routes(
  listing_id TEXT NOT NULL REFERENCES listings(id),
  program TEXT NOT NULL,
  server_reference TEXT,
  approval_state TEXT NOT NULL CHECK(approval_state IN ('unverified', 'pending', 'approved', 'excluded')),
  destination_verified_at TEXT,
  attribution_verified_at TEXT,
  PRIMARY KEY(listing_id, program)
);
CREATE TABLE IF NOT EXISTS bundle_components(
  bundle_observation_id TEXT NOT NULL REFERENCES price_observations(id),
  slot TEXT NOT NULL,
  variant_id TEXT REFERENCES variants(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  seller_description TEXT NOT NULL,
  evidence_id TEXT NOT NULL REFERENCES evidence(id),
  PRIMARY KEY(bundle_observation_id, slot)
);

CREATE INDEX IF NOT EXISTS observations_listing_time ON price_observations(listing_id, observed_at);
