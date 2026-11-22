"""Review bounded distributor SKUs and append validated one-unit merchant observations."""
from __future__ import annotations
import argparse,csv,json,re,unicodedata
from pathlib import Path
from collections import Counter
from ops.catalog.seorin_offer import parse_offer
from ops.catalog.store import merchant_identity
from ops.collector.build_prices import build,parse_now,parse_checked_at,product_attributes,conditional_prices

ROOT=Path(__file__).resolve().parents[2]
SCOPES=['m2-ssd','atx-psu','sfx-psu','mid-tower','air-coolers']
CATEGORIES={'m2-ssd':'ssd','atx-psu':'psu','sfx-psu':'psu','mid-tower':'case','air-coolers':'cooler'}
EXACT_IDS={'1000008000':'reviewed-lianli-sx1200-black','1000007999':'reviewed-lianli-sx1200-white'}

def read(file):return json.loads(file.read_text(encoding='utf-8'))
def write(file,value):file.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def normalized_name(name):
    value=unicodedata.normalize('NFKC',name).casefold()
    for a,b in [('thermalright',''),('써멀라이트',''),('서린',''),('화이트','white'),('블랙','black'),('그레이','gray'),('grey','gray')]:value=value.replace(a,b)
    return re.sub(r'[^a-z0-9가-힣]','',value)

def brand(name):
    for prefix,label in [('AGI','AGI'),('Apacer','Apacer'),('팀그룹','TEAMGROUP'),('리안리','LIAN LI'),('LIAN LI','LIAN LI'),('프렉탈디자인','Fractal Design'),('HYTE','HYTE'),('써멀라이트','Thermalright'),('Thermalright','Thermalright'),('ARCTIC','ARCTIC'),('포뮬라','Formula V')]:
        if name.startswith(prefix):return label
    raise ValueError('UNREVIEWED_DISTRIBUTOR_BRAND')

def selected_facts(row,category,source):
    name=row['name'];facts=[];specs=[];features=[]
    def add(key,value,label):
        facts.append(dict(key=key,value=str(value),source=source));specs.append(dict(label='판매처 표기 · '+label,value=str(value)))
    if category=='ssd':
        capacity=re.search(r'(\d+(?:\.\d+)?)\s*(TB|GB)',name)
        if not capacity:raise ValueError('SSD_CAPACITY_NOT_STATED')
        amount=int(float(capacity[1])*(1000 if capacity[2]=='TB' else 1))
        add('capacity',amount,'용량(GB)');add('formFactor','M.2','폼 팩터')
        if 'NVMe' in name:add('interface','NVMe','연결 표기')
        elif 'SATA' in name:add('interface','SATA','연결 표기')
        else:raise ValueError('SSD_INTERFACE_NOT_STATED')
        features=[f"{capacity[1]}{capacity[2]} · M.2 · {'NVMe' if 'NVMe' in name else 'SATA'} 판매 구성"]
    elif category=='psu':
        watt=re.search(r'\b(\d{3,4})W\b',name,re.I)
        if watt:add('wattage',watt[1],'정격 출력(W)')
        certification=re.search(r'80PLUS\s*(골드|플래티넘)',name,re.I)
        if certification:add('efficiency',{'골드':'GOLD','플래티넘':'PLATINUM'}[certification[1]],'효율 인증 표기')
        features=[name]
    elif category=='case':features=[name]
    else:
        add('coolerType','cpu-air-cooler','분류')
        features=['CPU 공랭 쿨러 · '+name]
    color=next((label for term,label in [('화이트','화이트'),('블랙','블랙'),('그레이','그레이')] if term in name),None)
    if color:specs.append(dict(label='판매처 표기 · 색상',value=color))
    return features,specs,facts

def apply(scopes,root=ROOT):
    private=root/'ops/private/distributor-audit/retailer-20261122'
    inventory=root/'ops/private/distributor-audit/20261122'
    path=root/'src/content/products/distributor-retail-reviewed.json';review=read(path)
    catalog=read(root/'src/content/products/catalog.json')['products'];byid={p['id']:p for p in catalog}
    initial=read(root/'src/content/products/distributor-reviewed.json')
    additions={p['id']:p for p in review['additions']};enrichments={p['id']:p for p in review['enrichments']}
    decisions={d['sourceId']:d for d in review['decisions']};links={d['listingId']:d for d in review['links']}
    csv_path=root/'ops/collector/input/products.csv'
    with csv_path.open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream);fields=list(reader.fieldnames);previous=list(reader)
    previous_by_source={merchant_identity(row['url']):row for row in previous}
    if len(previous_by_source)!=len(previous):raise ValueError('DUPLICATE_EXISTING_MERCHANT_SKU')
    rows_by_id={row['id']:row for row in previous};changed_ids=set()
    baseline=private/'baseline-v56-prices.json'
    if not baseline.exists():write(baseline,{p.stem:read(p) for p in (root/'src/content/prices').glob('*.json')})
    for scope in scopes:
        category=CATEGORIES[scope];source_rows=read(inventory/f'{scope}-inventory.json')['rows'];parsed=[]
        for row in source_rows:
            sid=row['sourceId'];source=read(private/(sid+'.source.json'))
            if merchant_identity(source['url'])!=('seorinexpress',sid):raise ValueError('SOURCE_IDENTITY_DRIFT')
            receipt=parse_offer((private/(sid+'.html')).read_text(encoding='utf-8'),source);parsed.append(receipt)
            if sid in decisions:continue
            target=EXACT_IDS.get(sid)
            if category=='cooler':
                matches=[p['id'] for p in catalog if p['category']=='cooler' and p['brand']=='Thermalright' and normalized_name(p['name'])==normalized_name(row['name'])]
                if len(matches)>1:raise ValueError('AMBIGUOUS_COOLER_IDENTITY')
                target=matches[0] if matches else None
            if target and target not in byid:raise ValueError('MISSING_EXISTING_PRODUCT_MATCH')
            existing=target is not None
            target=target or 'distributor-seorin-'+sid
            evidence=dict(label='서린 공식몰 · '+row['name'],url=source['url'],observedAt=source['observedAt'],kind='retailer-listing')
            features,specifications,facts=selected_facts(row,category,evidence)
            specifications.append(dict(label='판매처 선택 구성',value=row['name']+' · 수량1 · 추가 선택 없음' if receipt['state']=='confirmed' else row['name']))
            notes=['정확한 제조사 품번·상세 사양·국내 보증은 판매명과 별도로 대조해야 합니다. 제휴 여부와 품질 평가를 연결하지 않습니다.']
            if category=='ssd':notes.append('M.2는 크기 계열 표기입니다. PCIe 세대·길이·DRAM·NAND·성능 수치는 판매명으로 추정하지 않았습니다.')
            if receipt['state']!='confirmed':notes.append(receipt.get('reason','판매 상태 추가 확인 필요')+' · 현재 구매가를 등록하지 않았습니다.')
            patch=dict(id=target,features=features,specifications=specifications,facts=facts,sources=[evidence],notes=notes)
            if existing:enrichments[target]=patch
            else:
                additions[target]={**patch,'name':row['name'],'category':category,'brand':brand(row['name']),
                    'subtype':{'ssd':'internal-ssd','psu':'power-supply','case':'case-variant','cooler':'cpu-air-cooler'}[category],
                    'kind':'model','description':'국내 유통사 공식 판매 상세에서 모델·판매 구성과 조건을 확인한 항목입니다. 사양·보증·후기와 품질 평가는 출처별로 구분합니다.',
                    'lifecycle':'unknown','domesticState':'unverified','manufacturerPartNumber':None,'listObservedAt':None,
                    'strengths':[],'issues':[],'reviewSummary':None,'reviewSources':[],'listings':[]}
            decision=dict(sourceId=sid,productId=target,category=category,scope=scope,relation='existing-exact-model' if existing else 'new-retailer-variant',
                          priceState=receipt['state'],checkedAt=source['observedAt'],reason='브랜드·시리즈·색상·ARGB·버전 표기까지 일치한 모델' if existing else '동일한 기존 판매 옵션 없음 · 모델/색상/구성을 별도 보존')
            if receipt['state']=='confirmed':
                old=previous_by_source.get(('seorinexpress',sid));listing_id=old['id'] if old else 'retail-seorin-'+sid
                if old and old['category']!=category:raise ValueError('EXISTING_LISTING_CATEGORY_DRIFT')
                checked=parse_checked_at(receipt['checkedAt'],parse_now(None)).isoformat().replace('+00:00','Z')
                offer={**{key:receipt[key] for key in ['name','price','shippingFee','shippingNote','availability','seller','source']},
                       'id':listing_id,'category':category,'url':old['url'] if old else receipt['url'],'checkedAt':checked,
                       'availabilityCheckedAt':checked,'spec':row['name']+' · 수량1 · 추가 선택 없음',
                       'priceNote':receipt['priceNote']+' 공개 Npay 5% 안내는 상품금액 40만원 이상·최대6만원·대상카드 조건입니다. '+('이 상품 단품은 최소금액 미달.' if receipt['price']<400000 else '행사 연도·예산·대상카드·결제창 적용 확인 전으로 할인액 미산정.')}
                if category=='ssd':offer.update(capacityGB=int(next(f['value'] for f in facts if f['key']=='capacity')),ssdDram='unknown')
                product_attributes(offer,category);conditional_prices(offer,offer['price'])
                for key in offer:
                    if key not in fields:fields.append(key)
                rows_by_id[listing_id]={key:offer.get(key,'') for key in fields};changed_ids.add(listing_id)
                links[listing_id]=dict(productId=target,listingId=listing_id,checkedAt=checked)
                decision.update(listingId=listing_id,price=receipt['price'],shippingFee=receipt['shippingFee'])
            else:decision['pendingReason']=receipt.get('reason')
            decisions[sid]=decision
        write(private/f'{scope}-offers.json',parsed)
        if len(parsed)!=len(source_rows):raise ValueError('INCOMPLETE_DISTRIBUTOR_SCOPE')
    # Validate the full input before replacing any collector inputs.
    all_rows=list(rows_by_id.values())
    staging=private/'candidate-products.json';write(staging,all_rows)
    if build(staging,root,parse_now(None),True)!=0:raise ValueError('DISTRIBUTOR_PRICE_VALIDATION_FAILED')
    with csv_path.open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows({key:row.get(key,'') for key in fields} for row in all_rows)
    collector=read(root/'ops/collector/catalog.json');ids={r['id'] for r in all_rows}
    collector['products']=[p for p in collector['products'] if p['id'] not in ids]+[dict(id=r['id'],category=r['category'],seller=r['seller'],sourceUrl=r['url']) for r in all_rows]
    write(root/'ops/collector/catalog.json',collector)
    review.update(additions=list(additions.values()),enrichments=list(enrichments.values()),links=list(links.values()),decisions=list(decisions.values()))
    write(path,review)
    build(csv_path,root,parse_now(None),False)
    summary=read(root/'src/content/distributorReviewSummary.json')
    summary.update(reviewedEntries=61+len(decisions),addedModels=len(initial['additions'])+len(additions),enrichedModels=len(initial['enrichments'])+len(enrichments),pendingMatches=157-len(decisions),
                   verifiedRetailObservations=len(links),pendingRetailPrices=sum(d['priceState']!='confirmed' for d in decisions.values()))
    summary['retailCategoryCounts']={category:sum(d['category']==category and d['priceState']=='confirmed' for d in decisions.values()) for category in ['ssd','psu','case','cooler']}
    write(root/'src/content/distributorReviewSummary.json',summary)
    return dict(processedScopes=scopes,reviewed157=len(decisions),newModels=len(additions),matchedExisting=len(enrichments),retailQuotes=len(links),priceStates=dict(Counter(d['priceState'] for d in decisions.values())),changedPriceIds=sorted(changed_ids))

def main():
    p=argparse.ArgumentParser();p.add_argument('--scope',action='append',choices=SCOPES,required=True);p.add_argument('--apply',action='store_true',required=True);a=p.parse_args()
    print(json.dumps(apply(a.scope),ensure_ascii=False))

if __name__=='__main__':main()
