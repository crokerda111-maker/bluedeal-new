"""One page per selected official manufacturer; private response, no publication."""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from ops.catalog.public_fetch import PublicFetch, SourceStopped

ROOT = Path(__file__).resolve().parents[2]
SOURCES = {
    'amd-cpu': 'https://www.amd.com/en/products/specifications/processors.html',
    'asrock-board': 'https://www.asrock.com/mb/index.asp',
    'seasonic-psu': 'https://seasonic.com/comparison/',
    'thermalright-cooler': 'https://www.thermalright.com/product-category/products/heatsink/',
    'gigabyte-board': 'https://www.gigabyte.com/Motherboard',
    'fractal-case': 'https://www.fractal-design.com/products/cases/',
}


def probe(selected=None):
    directory = ROOT / 'ops/private/catalog/source-probes'
    directory.mkdir(parents=True, exist_ok=True)
    manifest = directory / 'manifest.local.json'
    previous = json.loads(manifest.read_text(encoding='utf-8')) if manifest.is_file() else []
    result = {record['source']: record for record in previous}
    for name, url in SOURCES.items():
        if selected and name not in selected:
            continue
        if name in result:
            # Successful snapshots are parsed offline; stopped sources are never
            # retried automatically. New executions do not refresh their time.
            print(json.dumps({'source': name, 'state': 'existing-result-preserved'}, ensure_ascii=False), flush=True)
            continue
        parsed = urlsplit(url)
        client = PublicFetch(f'{parsed.scheme}://{parsed.netloc}')
        try:
            client.robots()
            raw, charset = client.get(url)
            (directory / f'{name}.html').write_bytes(raw)
            record = {'source': name, 'url': url, 'state': 'fetched', 'bytes': len(raw), 'charset': charset,
                      'retrieved_at': datetime.now(timezone.utc).isoformat(), 'sha256': hashlib.sha256(raw).hexdigest()}
        except SourceStopped as error:
            record = {'source': name, 'url': url, 'state': str(error), 'retrieved_at': datetime.now(timezone.utc).isoformat()}
        result[name] = record
        print(json.dumps(record, ensure_ascii=False), flush=True)
        pending = directory / 'manifest.pending.local.json'
        pending.write_text(json.dumps(list(result.values()), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        pending.replace(manifest)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='append', choices=sorted(SOURCES))
    probe(parser.parse_args().source)
