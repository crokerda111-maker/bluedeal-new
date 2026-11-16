"""Public deployment fingerprint. Never includes account or feed credentials."""
from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import subprocess
from pathlib import Path
from typing import Any

CONTRACT_PATH = "src/content/priceSnapshot.schema.json"
CATEGORIES = {"cooler", "cpu", "fullpc", "gpu", "halfpc", "motherboard", "ram", "ssd"}


def scalar(value: Any) -> list[str]:
    if value is None:
        return ["z"]
    if isinstance(value, str):
        return ["s", value]
    if isinstance(value, bool):
        return ["b", "1" if value else "0"]
    if isinstance(value, (int, float)) and math.isfinite(value):
        return ["n", struct.pack(">d", 0.0 if value == 0 else float(value)).hex()]
    raise ValueError("INVALID_PRICE_SNAPSHOT_SCALAR")


def public_price_snapshot(meta: dict, categories: list[dict], outbound: dict, contract: dict) -> dict:
    if contract.get("schemaVersion") != 1 or contract.get("encoding") != "typed-ieee754-v1":
        raise ValueError("UNSUPPORTED_PRICE_SNAPSHOT")
    keys = contract["categories"]
    if len(set(keys)) != len(keys):
        raise ValueError("INVALID_PRICE_SNAPSHOT_CATEGORIES")
    ordered = []
    for key in keys:
        matches = [item for item in categories if item.get("category") == key]
        if len(matches) != 1:
            raise ValueError("INVALID_PRICE_SNAPSHOT_CATEGORIES")
        ordered.append(matches[0])
    if len(ordered) != len(categories):
        raise ValueError("INVALID_PRICE_SNAPSHOT_CATEGORIES")
    canonical = [
        contract["schemaVersion"],
        [scalar(meta.get(field)) for field in ("updatedAt", "generatedAt", "schedule", "note")],
        [[
            scalar(category["category"]), scalar(category.get("updatedAt")), scalar(category.get("generatedAt")),
            [[scalar(item.get(field)) for field in contract["itemFields"]]
             for item in sorted(category["items"], key=lambda item: item["id"])],
        ] for category in ordered],
        [[scalar(value) for value in (code, outbound[code].get("code"), outbound[code].get("merchant"), outbound[code].get("originalUrl"))]
         for code in sorted(outbound)],
    ]
    wire = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    return {
        "service": "BLUEDEAL", "schemaVersion": contract["schemaVersion"],
        "snapshotHash": hashlib.sha256(wire).hexdigest(),
        "updatedAt": meta["updatedAt"], "generatedAt": meta.get("generatedAt"), "schedule": meta["schedule"],
        "itemCount": sum(len(category["items"]) for category in ordered),
        "categories": [{"category": category["category"], "itemCount": len(category["items"]), "updatedAt": category["updatedAt"]} for category in ordered],
    }


def read_snapshot_json(root: Path, relative: str, commit: str | None = None) -> Any:
    if commit is None:
        return json.loads((root / relative).read_text(encoding="utf-8-sig"))
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("INVALID_EXPECTED_COMMIT")
    result = subprocess.run(["git", "show", f"{commit}:{relative}"], cwd=root, capture_output=True, timeout=10, check=False)
    if result.returncode or len(result.stdout) > 5 * 1024 * 1024:
        raise ValueError("COMMITTED_SNAPSHOT_UNAVAILABLE")
    return json.loads(result.stdout.decode("utf-8-sig"))


def load_price_snapshot(root: Path, commit: str | None = None) -> dict:
    contract = read_snapshot_json(root, CONTRACT_PATH, commit)
    if set(contract["categories"]) != CATEGORIES:
        raise ValueError("INVALID_PRICE_SNAPSHOT_CATEGORIES")
    meta = read_snapshot_json(root, "src/content/prices/meta.json", commit)
    categories = [read_snapshot_json(root, f"src/content/prices/{key}.json", commit) for key in contract["categories"]]
    outbound = read_snapshot_json(root, "src/content/outbound.generated.json", commit)
    return public_price_snapshot(meta, categories, outbound, contract)
