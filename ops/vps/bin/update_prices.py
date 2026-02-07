#!/usr/bin/env python3
"""BLUEDEAL 가격현황 JSON 생성(샘플)

- 처음에는 '샘플 데이터'로 JSON 구조만 맞추는 용도
- 이후 실제 수집 로직을 붙이면 그대로 운영 가능

사용:
  python3 update_prices.py --out /srv/bluedeal-api/public
"""

import argparse
import json
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

CATEGORIES = [
  "ram",
  "cpu",
  "motherboard",
  "gpu",
  "cooler",
  "halfpc",
  "fullpc",
]

SAMPLE_ITEMS = {
  "ram": [
    {"id": "ram-sample-1", "name": "DDR5 32GB (16x2) 6000", "spec": "DDR5 / 32GB / 6000", "price": 129000, "source": "sample", "url": "https://example.com"},
    {"id": "ram-sample-2", "name": "DDR4 32GB (16x2) 3200", "spec": "DDR4 / 32GB / 3200", "price": 79000, "source": "sample", "url": "https://example.com"},
  ],
  "cpu": [
    {"id": "cpu-sample-1", "name": "Ryzen 7 7800X3D", "spec": "AM5 / 8C16T", "price": 469000, "source": "sample", "url": "https://example.com"},
    {"id": "cpu-sample-2", "name": "Core i5-14600K", "spec": "LGA1700 / 14C20T", "price": 359000, "source": "sample", "url": "https://example.com"},
  ],
  "motherboard": [
    {"id": "mb-sample-1", "name": "B650 ATX 보드", "spec": "B650 / ATX / Wi‑Fi", "price": 219000, "source": "sample", "url": "https://example.com"},
    {"id": "mb-sample-2", "name": "B760 mATX 보드", "spec": "B760 / mATX", "price": 159000, "source": "sample", "url": "https://example.com"},
  ],
  "gpu": [
    {"id": "gpu-sample-1", "name": "RTX 4070 SUPER", "spec": "12GB", "price": 849000, "source": "sample", "url": "https://example.com"},
    {"id": "gpu-sample-2", "name": "RX 7800 XT", "spec": "16GB", "price": 699000, "source": "sample", "url": "https://example.com"},
  ],
  "cooler": [
    {"id": "cooler-sample-1", "name": "공랭 타워 쿨러", "spec": "공랭 / 157mm", "price": 39000, "source": "sample", "url": "https://example.com"},
    {"id": "cooler-sample-2", "name": "수랭 360", "spec": "수랭 / 360mm", "price": 149000, "source": "sample", "url": "https://example.com"},
  ],
  "halfpc": [
    {"id": "halfpc-sample-1", "name": "반본체 (7800X3D/32G/1TB)", "spec": "CPU+보드+램+SSD", "price": 1099000, "source": "sample", "url": "https://example.com"},
    {"id": "halfpc-sample-2", "name": "반본체 (i5/32G/1TB)", "spec": "CPU+보드+램+SSD", "price": 799000, "source": "sample", "url": "https://example.com"},
  ],
  "fullpc": [
    {"id": "fullpc-sample-1", "name": "완본체 (4070S 포함)", "spec": "CPU+GPU+OS", "price": 1899000, "source": "sample", "url": "https://example.com"},
    {"id": "fullpc-sample-2", "name": "완본체 (사무용)", "spec": "OS 포함", "price": 599000, "source": "sample", "url": "https://example.com"},
  ],
}


def now_seoul_iso() -> str:
  tz = ZoneInfo("Asia/Seoul")
  return datetime.now(tz).isoformat(timespec="seconds")


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument("--out", required=True, help="output directory (e.g. /srv/bluedeal-api/public)")
  args = ap.parse_args()

  out_dir = Path(args.out)
  prices_dir = out_dir / "prices"
  prices_dir.mkdir(parents=True, exist_ok=True)

  updated_at = now_seoul_iso()

  # meta.json
  meta = {
    "updatedAt": updated_at,
    "schedule": "매일 09:00 / 17:00 갱신",
    "note": "샘플 데이터입니다. 실제 수집 로직으로 교체하세요.",
  }
  (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

  # category files
  for cat in CATEGORIES:
    payload = {
      "category": cat,
      "updatedAt": updated_at,
      "items": SAMPLE_ITEMS.get(cat, []),
    }
    (prices_dir / f"{cat}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

  print(f"[OK] wrote meta.json and {len(CATEGORIES)} category files to: {out_dir}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
