"""Read minimal public post facts for a specified private review category.

Never follows purchase links, stores bodies/comments/identities, or publishes prices.
Reuses the research transport's robots, rate, same-origin and stop rules.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

sys.path.insert(0,str(Path(__file__).resolve().parent))
from bs4 import BeautifulSoup
from crawler import Transport, CrawlStop
from parsers import KST, detail_posted_at

ROOT=Path(__file__).resolve().parents[2]
FLAGS={'쿠폰 언급':r'쿠폰|할인코드','카드 언급':r'카드|롯카|국카|VISA','포인트·적립':r'적립|포인트|캐시백','리뷰 보상':r'리뷰.{0,12}이벤트|포토.{0,12}이벤트','경유 조건':r'페이북|경유|바로가기','코인':r'코인','체감가':r'체감'}

def extract(html,post_url):
    soup=BeautifulSoup(html,'html.parser')
    if soup.select_one('#captcha, .g-recaptcha') or re.search(r'Incapsula|Access Denied|verify you are human',soup.get_text(' ',strip=True),re.I):
        raise CrawlStop('접근 확인 화면입니다. 우회하지 않고 중단합니다.')
    heading=soup.find('h1'); table=soup.select_one('table.market-info-view-table')
    if not heading or not table: raise CrawlStop('원문 구조를 확인하지 못해 중단합니다.')
    fields={}
    for tr in table.find_all('tr'):
        cells=tr.find_all(['th','td'],recursive=False)
        if len(cells)>=2: fields[cells[0].get_text(' ',strip=True)]=cells[1].get_text(' ',strip=True)
    links=[]
    candidates=[anchor.get('href','').strip() for anchor in table.select('a[href]')]
    candidates+=re.findall(r'https://[^\s<>"\x27]+',table.get_text(' ',strip=True))
    for href in candidates:
        try: parsed=urlsplit(href)
        except ValueError: continue
        if parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password and parsed.hostname!='quasarzone.com':
            links.append(href)
    body=soup.select_one('#org_contents')
    text=body.get_text(' ',strip=True) if body else ''
    published=detail_posted_at(html,post_url)
    return {'title':heading.get_text(' ',strip=True),'ended_in_heading':'종료' in heading.get_text(' ',strip=True),
            'merchant_label':fields.get('판매처'),'community_price_text':fields.get('가격'),
            'community_shipping_text':fields.get('배송/직배'),'merchant_link_candidates':list(dict.fromkeys(links)),
            'condition_flags':[name for name,pattern in FLAGS.items() if re.search(pattern,text,re.I)],
            'published_at':published.isoformat() if published else None,'body_stored':False,'comments_stored':False,
            'current_price_verified':False,'parser_version':2}

def run(category):
    audit=json.loads((ROOT/'ops/private/catalog-review/event-audit/review.generated.local.json').read_text(encoding='utf-8'))
    rows=[row for row in audit['posts'] if row['category']==category and row['disposition']=='상품 후보']
    if not rows: raise ValueError('검토 대상이 없습니다.')
    out=ROOT/'ops/private/catalog-review'/f'{category}-post-links.local.json'
    result=json.loads(out.read_text(encoding='utf-8')) if out.exists() else {'category':category,'state':'new','posts':[]}
    if result['state']=='access-stopped': raise ValueError('이 출처는 중단 상태입니다. 자동 재시도하지 않습니다.')
    known={row['post_id'] for row in result['posts'] if row.get('parser_version')==2}
    transport=Transport('https://quasarzone.com'); transport.load_robots()
    result['state']='running'
    try:
        for row in rows:
            post_id=row['id'].split(':')[1]
            if post_id in known: continue
            url=f'https://quasarzone.com/bbs/qb_saleinfo/views/{post_id}'
            if url!=row['post_url'] or not re.fullmatch(r'\d+',post_id): raise ValueError('출처 주소 불일치')
            html=transport.get(url)
            item={'post_id':post_id,'post_url':url,'retrieved_at':datetime.now(KST).isoformat(),'response_sha256':hashlib.sha256(html.encode()).hexdigest(),**extract(html,url)}
            previous=next((index for index,old in enumerate(result['posts']) if old['post_id']==post_id),None)
            if previous is None: result['posts'].append(item)
            else: result['posts'][previous]=item
            out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(json.dumps({'category':category,'done':len(result['posts']),'total':len(rows),'post_id':post_id,'links':len(item['merchant_link_candidates'])}),flush=True)
        result['state']='complete'
    except CrawlStop as error:
        result['state']='access-stopped'; result['reason']=str(error)
    finally:
        out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'state':result['state'],'done':len(result['posts']),'total':len(rows)},ensure_ascii=False),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--category',required=True,choices=['motherboard','psu','cpu','ram','gpu','ssd','cooler','case','halfpc','fullpc','bundle'])
    run(parser.parse_args().category)
