"""Extract minimal post metadata. Title hints are not verified product specs."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
import unicodedata
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit
from bs4 import BeautifulSoup

KST = timezone(timedelta(hours=9))
CATEGORY_LABELS = {'cpu':'CPU','motherboard':'메인보드','ram':'RAM','psu':'파워','fullpc':'완본체','halfpc':'반본체','gpu':'그래픽카드','ssd':'SSD/HDD','cooler':'쿨러','case':'케이스','bundle':'부품 묶음','other':'기타/분류 검토'}
CPU = r'(?<![A-Z0-9])(?:[5789][3-9](?:00|50)(?:X3D|XT|X|G|F)?|(?:I[3579][- ]?)?1[0-5]\d{3}(?:KF|KS|K|F|T)?|(?:ULTRA\s*[579]\s*)?[23][456789]\d(?:KF|K|F)?)(?![A-Z0-9])'
CPU_CONTEXT = r'CPU|라이젠|RYZEN|코어\s*(?:울트라|I[3579])|CORE\s*(?:ULTRA|I[3579])|인텔|AMD'
BOARD = r'(?<![A-Z0-9])(?:[ABX][368][2567]0[MEI]?|[HBZ][678]90[MEI]?|[ABX][468]50[MEI]?|[HBZ][678]60[MEI]?|[ABX][368]70E?[MEI]?)(?![A-Z0-9])|메인보드|MOTHERBOARD'
GPU = r'(?<![A-Z0-9])(?:RTX\s*[345]\d{3}(?:\s*TI)?(?:\s*SUPER)?|RX\s*[679]\d{3}(?:\s*XTX|\s*XT|\s*GRE)?)(?![A-Z0-9])'


def clean(value: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', value or '')).strip()


def classify(title: str) -> tuple[str, list[str]]:
    text = clean(title).upper()
    if re.search(r'노트북|LAPTOP|MACBOOK|갤럭시북', text):
        return 'other', []
    half = bool(re.search(r'반본체|반\s*본체|베어본|BAREBONE|그래픽\s*(?:카드\s*)?(?:미포함|제외|없)', text))
    full = bool(re.search(r'완본체|완\s*본체|조립\s*PC|게이밍\s*PC|데스크[톱탑]|컴퓨터\s*본체|미니\s*PC|MINI\s*PC', text))
    if half:
        return 'halfpc', ['halfpc']
    if full:
        return 'fullpc', ['fullpc']
    # Accessories which mention CPUs/RAM are not sold as those components.
    if re.search(r'쿨러|수랭|수냉|공랭|워터블[록럭]|PALADIN\s*\d|PEERLESS\s*ASSASSIN|램\s*방열판', text):
        return 'cooler', ['cooler']
    if re.search(r'컴퓨터\s*케이스|PC\s*케이스|미들타워|빅타워|어항\s*케이스', text):
        return 'case', ['case']
    hits = []
    cpu = bool(re.search(CPU, text))
    if cpu and (re.search(CPU_CONTEXT, text) or re.search(r'(?<!\w)[5-9]\d{3}X3D(?!\w)', text)):
        hits.append('cpu')
    if re.search(BOARD, text):
        hits.append('motherboard')
    if re.search(r'DDR[345]|\b(?:SODIMM|UDIMM|CUDIMM)\b|메모리|(?:^|\W)RAM(?:\W|$)|(?:^|\W)램(?:\W|$)', text):
        hits.append('ram')
    if re.search(GPU, text) or re.search(r'그래픽\s*카드|지포스|라데온', text):
        hits.append('gpu')
    if re.search(r'\b(?:SSD|HDD|NVME)\b|솔리드스테이트|하드디스크|(?:990|9100)\s*(?:EVO|PRO)', text):
        hits.append('ssd')
    if not re.search(r'충전기|보조배터리|파워뱅크|POWER\s*BANK', text) and re.search(r'파워서플라이|\bPSU\b|80\s*PLUS|80플러스|ATX\s*3\.[01]|(?:파워|풀모듈러).{0,35}\b\d{3,4}\s*W\b|\b\d{3,4}\s*W\b.{0,35}(?:파워|풀모듈러)', text):
        hits.append('psu')
    if len(hits) > 1:
        return 'bundle', hits
    return (hits[0], hits) if hits else ('other', [])


def model_hints(title: str) -> list[str]:
    text = clean(title).upper()
    hints = re.findall(GPU, text)
    if re.search(CPU_CONTEXT, text) or 'X3D' in text:
        hints += re.findall(CPU, text)
    return sorted(set(clean(value) for value in hints if value))


def candidate_key(title: str, category: str) -> str:
    # Exact normalized product-title grouping only: do not merge capacities or kits.
    text = re.sub(r'^\[[^\]]{1,35}\]\s*', '', clean(title))
    return hashlib.sha256((category + '|' + text.casefold()).encode()).hexdigest()[:20]


def obvious_non_pc(title: str) -> bool:
    return bool(re.search(r'햅쌀|백미|현미|생수|도시락|함박|떡볶|떡산적|홈런볼|과자|펩시|코카콜라|감귤|라면|햇반|한돈|소고기|돼지고기|닭가슴|삼겹|로션|샴푸|치약|세제|방향제|섬유유연|티셔츠|러닝화|런닝화|아디다스|나이키|바지|패딩|베개|이불|장작|커피머신|김치|크랩|갈비|미용실|화장품|선크림',clean(title),re.I))


def interpret(row: dict) -> dict:
    row=dict(row)
    category,categories=classify(row['title'])
    truncated=bool(re.search(r'(?:\.\.\.|…)$',row['title']))
    key=candidate_key(row['title'],category)
    if truncated: key=hashlib.sha256((key+'|'+row['source']+'|'+row['post_id']).encode()).hexdigest()[:20]
    text=row['title'].upper()
    variant_separator=bool(re.search(r'/|또는|\bOR\b',text))
    cpu_variants=len(set(re.findall(CPU,text)))>1 and (re.search(CPU_CONTEXT,text) or 'X3D' in text)
    gpu_variants=len(set(re.findall(GPU,text)))>1
    multiple=bool(re.search(r'모음전|가격\s*상이|외\s*다수|상품\s*모음',row['title'])) or variant_separator and (cpu_variants or gpu_variants)
    kind='raffle' if re.search(r'래플|응모|추첨',row['title']) else 'multiple' if multiple else 'listing'
    row.update(category=category,category_hints=categories,model_hints=model_hints(row['title']),candidate_key=key,title_truncated=truncated,offer_kind=kind,interpretation_version=2,**price_hint(row.get('price_text','')))
    if kind!='listing': row['price_amount']=None
    return row


def price_hint(value: str) -> dict:
    raw = clean(value)
    result = {'price_text':raw,'price_amount':None,'currency':None,'price_basis':'community_reported_unverified','is_current_price':False}
    if not raw or re.search(r'부터|상이|별도|최저|최대|~|외\s*다수|[-−]\s*\d', raw):
        return result
    currencies = set()
    if re.search(r'₩|￦|원|KRW', raw, re.I): currencies.add('KRW')
    if re.search(r'\$|USD', raw, re.I): currencies.add('USD')
    if re.search(r'€|EUR', raw, re.I): currencies.add('EUR')
    if len(currencies) != 1:
        return result
    amounts = re.findall(r'(?<![\w.])\d[\d,]*(?:\.\d{1,2})?(?![\w.])', raw)
    if len(amounts) != 1 or re.search(r'만\s*원|%|\d\s*[+×xX]', raw):
        return result
    try:
        amount = Decimal(amounts[0].replace(',', ''))
    except InvalidOperation:
        return result
    currency = currencies.pop()
    if amount <= 0 or (currency == 'KRW' and amount != int(amount)):
        return result
    result.update(price_amount=str(amount),currency=currency)
    return result


def posted_interval(value: str, observed: datetime) -> tuple[str|None,str|None,str]:
    text = clean(value)
    observed = observed.astimezone(KST)
    if 'T' in text:
        try:
            stamp=datetime.fromisoformat(text.replace('Z','+00:00'))
            if stamp.tzinfo:
                return stamp.isoformat(),(stamp+timedelta(seconds=1)).isoformat(),'second'
        except ValueError:
            pass
    match = re.fullmatch(r'(\d+)\s*(분|시간|일)\s*전', text)
    if match:
        quantity, unit = int(match[1]), match[2]
        delta = {'분':timedelta(minutes=1),'시간':timedelta(hours=1),'일':timedelta(days=1)}[unit]
        return (observed - (quantity + 1) * delta).isoformat(), (observed - quantity * delta).isoformat(), 'relative_' + {'분':'minute','시간':'hour','일':'day'}[unit]
    if text in ('방금', '방금 전'):
        return (observed-timedelta(minutes=1)).isoformat(), observed.isoformat(), 'relative_minute'
    month_day=re.fullmatch(r'(\d{1,2})[.\-/](\d{1,2})',text)
    if month_day:
        month,day=map(int,month_day.groups())
        year=observed.year-((month,day)>(observed.month,observed.day))
        try: start=datetime(year,month,day,tzinfo=KST)
        except ValueError: return None,None,'unknown'
        # The year is explicitly marked as inferred; a cutoff detail anchor is checked by the runner.
        return start.isoformat(),(start+timedelta(days=1)).isoformat(),'day-year-inferred'
    match = re.fullmatch(r'(\d{2}|\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?', text)
    if match:
        year, month, day = map(int,match.group(1,2,3))
        year = year + 2000 if year < 100 else year
        try:
            start=datetime(year,month,day,int(match[4] or 0),int(match[5] or 0),int(match[6] or 0),tzinfo=KST)
        except ValueError:
            return None,None,'unknown'
        precision='second' if match[6] else 'minute' if match[4] else 'day'
        width={'second':timedelta(seconds=1),'minute':timedelta(minutes=1),'day':timedelta(days=1)}[precision]
        return start.isoformat(),(start+width).isoformat(),precision
    return None,None,'unknown'


def detail_posted_at(html: str,post_url: str) -> datetime|None:
    soup=BeautifulSoup(html,'html.parser')
    documents=[]
    def inspect(value):
        if isinstance(value,list):
            for child in value: inspect(child)
        elif isinstance(value,dict):
            types=value.get('@type',[]);types=[types] if isinstance(types,str) else types
            if any(t in ('Article','BlogPosting','DiscussionForumPosting','NewsArticle') for t in types): documents.append(value)
            if '@graph' in value: inspect(value['@graph'])
    for script in soup.select('script[type="application/ld+json"]'):
        try: inspect(json.loads(script.string or script.get_text()))
        except (ValueError,TypeError): continue
    for doc in documents:
        identity=doc.get('url') or doc.get('@id') or doc.get('mainEntityOfPage')
        if isinstance(identity,dict): identity=identity.get('@id') or identity.get('url')
        if identity:
            expected=urlsplit(post_url);actual=urlsplit(urljoin(post_url,str(identity)))
            if (expected.netloc,expected.path)!=(actual.netloc,actual.path): continue
        elif len(documents)!=1: continue
        try:
            stamp=datetime.fromisoformat(str(doc.get('datePublished','')).replace('Z','+00:00'))
            if stamp.tzinfo: return stamp.astimezone(KST)
        except ValueError: continue
    return None


def record(source: str, post_id: str, url: str, title: str, date_text: str, price_text: str, observed: datetime, **extra) -> dict:
    lower,upper,precision=posted_interval(date_text,observed)
    category, categories=classify(title)
    return interpret({'source':source,'post_id':str(post_id),'post_url':url,'title':clean(title),'category':category,'category_hints':categories,'model_hints':model_hints(title),'candidate_key':candidate_key(title,category),'posted_text':clean(date_text),'posted_lower':lower,'posted_upper':upper,'date_precision':precision,'observed_at':observed.isoformat(),'current_price':None,'merchant_verified_at':None,**price_hint(price_text),**extra})


def quasarzone(html: str, observed: datetime, current_page: int=1) -> tuple[list[dict],str|None]:
    soup=BeautifulSoup(html,'html.parser')
    rows=[]
    for row in soup.select('.v2-list-row--hotdeal'):
        a=row.select_one('a.subject-link[href]')
        if not a: continue
        target=urlsplit(urljoin('https://quasarzone.com',a['href']))
        match=re.fullmatch(r'/bbs/qb_saleinfo/views/(\d+)',target.path) if target.scheme=='https' and target.netloc=='quasarzone.com' else None
        if not match: continue
        def text(selector):
            el=row.select_one(selector)
            return el.get_text(' ',strip=True) if el else ''
        # Partner placements without a regular-row date are not counted as a page boundary.
        if not row.select_one('.v2-list-row__time'): continue
        shop=row.select_one('.v2-shop-logo[alt]')
        rows.append(record('quasarzone',match[1],'https://quasarzone.com/bbs/qb_saleinfo/views/'+match[1],a.get_text(' ',strip=True),text('.v2-list-row__time'),text('.v2-list-row__price'),observed,source_category=text('.v2-badge'),shop_hint=shop.get('alt','') if shop else '',shipping_text=' | '.join(el.get_text(' ',strip=True) for el in row.select('.v2-list-row__ship') if el.get_text(strip=True)),ended='is-done' in row.get('class',[])))
    return dedup(rows),next_page(soup,'quasarzone','https://quasarzone.com/bbs/qb_saleinfo',current_page)


def ppomppu(html: str, observed: datetime, current_page: int=1) -> tuple[list[dict],str|None]:
    soup=BeautifulSoup(html,'html.parser')
    rows=[]
    for tr in soup.select('tr'):
        a=next((a for a in tr.select('a[href]') if 'view.php?' in a['href'] and parse_qs(urlsplit(a['href']).query).get('id')==['ppomppu'] and a.get_text(strip=True)),None)
        if not a: continue
        query=parse_qs(urlsplit(a['href']).query);post_id=(query.get('no') or [''])[0]
        if not post_id.isdigit(): continue
        cells=tr.select('td')
        dates=[clean(el.get('title') or el.get_text(' ',strip=True)) for el in cells if re.search(r'\d{2}/\d{2}/\d{2}',el.get('title','')+' '+el.get_text(' ',strip=True))]
        date=next((m[0] for value in dates if (m:=re.findall(r'\d{2}/\d{2}/\d{2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?',value))), '')
        title=a.get_text(' ',strip=True)
        price_match=re.search(r'\(([^()]*(?:원|\$)[^()]*)\)',title)
        rows.append(record('ppomppu',post_id,'https://www.ppomppu.co.kr/zboard/view.php?id=ppomppu&no='+post_id,title,date,(price_match[1].split('/')[0] if price_match else ''),observed,source_category='컴퓨터',shop_hint='',shipping_text='',ended=bool(tr.select('.list_line.end, .end'))))
    return dedup(rows),next_page(soup,'ppomppu','https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu&category=4',current_page)


def coolenjoy(html: str, observed: datetime, current_page: int=1) -> tuple[list[dict],str|None]:
    soup=BeautifulSoup(html,'html.parser')
    rows=[]
    for row in soup.select('tr, .list-item'):
        a=next((a for a in row.select('a[href]') if re.search(r'/bbs/jirum/\d+(?:\?|$)',a['href']) and a.get_text(strip=True)),None)
        if not a: continue
        post_id=re.search(r'/bbs/jirum/(\d+)',a['href'])[1]
        date_el=row.select_one('time, .td_datetime, .list-date')
        date=date_el.get('datetime') or date_el.get('title') or date_el.get_text(strip=True) if date_el else ''
        title=a.get_text(' ',strip=True)
        price_match=re.search(r'\(([^()]*(?:원|\$)[^()]*)\)',title)
        rows.append(record('coolenjoy',post_id,'https://coolenjoy.net/bbs/jirum/'+post_id,title,date,price_match[1].split('/')[0] if price_match else '',observed,source_category='',shop_hint='',shipping_text='',ended=False))
    return dedup(rows),next_page(soup,'coolenjoy','https://coolenjoy.net/bbs/jirum',current_page)


def dedup(rows):
    return list({(row['source'],row['post_id']):row for row in rows}.values())


def page_url(source: str, base: str, page: int) -> str:
    p=urlsplit(base);query=parse_qs(p.query,keep_blank_values=True);query['page']=[str(page)]
    return urlunsplit((p.scheme,p.netloc,p.path,urlencode(query,doseq=True),''))


def next_page(soup, source: str, base: str, current: int) -> str|None:
    pages=[]
    for a in soup.select('a[href]'):
        url=urljoin(base,a['href']);p=urlsplit(url)
        if p.netloc!=urlsplit(base).netloc or p.path!=urlsplit(base).path: continue
        query=parse_qs(p.query)
        n=(query.get('page') or [''])[0]
        if n.isdigit() and int(n)>current: pages.append(int(n))
    # The runner computes and verifies monotone page numbers from the current URL.
    return page_url(source,base,min(pages)) if pages else None


PARSERS={'quasarzone':quasarzone,'ppomppu':ppomppu,'coolenjoy':coolenjoy}
