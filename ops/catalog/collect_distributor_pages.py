"""Archive explicit public retailer detail URLs; preserve observations on resume."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib,json
from pathlib import Path
from ops.catalog.public_fetch import PublicFetch,SourceStopped

SCOPES=['m2-ssd','atx-psu','sfx-psu','mid-tower','air-coolers']

def collect(root, scopes):
    inventory=root/'ops/private/distributor-audit/20261122'
    output=root/'ops/private/distributor-audit/retailer-20261122';output.mkdir(parents=True,exist_ok=True)
    stop_file=output/'source-stopped.json'
    if stop_file.exists():raise ValueError('SOURCE_STOPPED_REQUIRES_REVIEW')
    client=PublicFetch('https://www.seorinexpress.com');client.robots()
    for scope in scopes:
        rows=json.loads((inventory/f'{scope}-inventory.json').read_text(encoding='utf-8'))['rows']
        count=0
        for row in rows:
            path=output/(row['sourceId']+'.html');meta=output/(row['sourceId']+'.source.json')
            if path.exists() and meta.exists():
                saved=json.loads(meta.read_text(encoding='utf-8'))
                if saved['url']!=row['detailUrl']:raise ValueError('RETAILER_IDENTITY_DRIFT')
                count+=1;continue
            try:body,charset=client.get(row['detailUrl'])
            except SourceStopped as error:
                stop_file.write_text(json.dumps(dict(source='seorinexpress',reason=str(error),url=row['detailUrl'],scope=scope,observedAt=datetime.now(timezone.utc).isoformat()),indent=2)+'\n',encoding='utf-8')
                print(json.dumps(dict(scope=scope,completed=count,total=len(rows),stopped=str(error))),flush=True);return
            observed=datetime.now(timezone.utc).isoformat()
            path.write_text(body.decode(charset or 'utf-8',errors='replace'),encoding='utf-8')
            meta.write_text(json.dumps(dict(url=row['detailUrl'],observedAt=observed,sha256=hashlib.sha256(body).hexdigest(),sourceId=row['sourceId'],listName=row['name'],scope=scope),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            count+=1
            if count%5==0:print(json.dumps(dict(scope=scope,completed=count,total=len(rows))),flush=True)
        print(json.dumps(dict(scope=scope,completed=count,total=len(rows),status='archived')),flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--scope',choices=SCOPES,action='append');args=parser.parse_args()
    collect(Path(__file__).resolve().parents[2],args.scope or SCOPES)

if __name__=='__main__':main()
