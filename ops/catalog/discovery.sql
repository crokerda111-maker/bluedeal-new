CREATE TABLE IF NOT EXISTS manufacturer_sources(
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  state TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  parsed_at TEXT NOT NULL,
  source_hash TEXT,
  observed_items INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS manufacturer_items(
  source_id TEXT NOT NULL REFERENCES manufacturer_sources(id),
  source_item_id TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category TEXT NOT NULL,
  item_kind TEXT NOT NULL CHECK(item_kind IN ('model', 'listed-wattage-option', 'product-family')),
  display_name TEXT NOT NULL,
  model_url TEXT NOT NULL,
  attributes_json TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK(lifecycle IN ('unknown', 'listed-current', 'listed-discontinued')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  linked_part_id TEXT REFERENCES parts(id),
  domestic_state TEXT NOT NULL DEFAULT 'unknown' CHECK(domestic_state IN ('unknown', 'confirmed', 'not-confirmed')),
  PRIMARY KEY(source_id, source_item_id)
);
CREATE TABLE IF NOT EXISTS manufacturer_item_observations(
  source_id TEXT NOT NULL,
  source_item_id TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY(source_id, source_item_id, source_hash),
  FOREIGN KEY(source_id, source_item_id) REFERENCES manufacturer_items(source_id, source_item_id)
);
