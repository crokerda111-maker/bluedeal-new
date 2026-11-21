"""Offline, reproducible review of archived deal posts against the public catalog.

This produces private research queues, never products, current prices or coupon rules.
Title matches are related-item hints, not exact-SKU verification.
"""
from __future__ import annotations

from collections import Counter
import calendar
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
LABELS = {'cpu':'CPU','motherboard':'메인보드','ram':'RAM','gpu':'그래픽카드','psu':'파워','ssd':'SSD/HDD','hdd':'HDD','case':'케이스','cooler':'쿨러·방열판','fullpc':'완본체','halfpc':'반본체','bundle':'묶음·구성 검토'}
MARKETS = {'지마켓':'G마켓','G마켓':'G마켓','G마켓/옥션':'G마켓·옥션 구분 필요','옥션':'옥션','11번가':'11번가','알리':'알리익스프레스','네이버':'네이버','쿠팡':'쿠팡','SSG':'SSG','하이마트':'하이마트','롯데온':'롯데ON','아마존':'아마존','오늘의집':'오늘의집'}
HINTS = [('쿠폰·코드', r'쿠폰|코드|COUPON'), ('카드 조건', r'카드|삼성비자|롯카|국카|신한|국민|VISA|MASTER'), ('결제 경로', r'페이|PAY|무통장'), ('회원 조건', r'멤버|회원|와우|클럽'), ('사후 적립·체감가', r'적립|체감|캐시백|포인트'), ('리뷰 보상', r'리뷰\s*이벤트|후기\s*이벤트'), ('코인', r'코인')]
TOKEN = re.compile(r'\b(?:RTX|GTX|RX)\s*\d{3,4}(?:\s*(?:TI|SUPER|XTX|XT|GRE)){0,2}\b|(?<![A-Z0-9])\d{4,5}(?:X3D|KF|KS|XT|GT|X|G|F|K)(?![A-Z0-9])|\b[ABHXZ]\d{3}[EMI]?\b|\bSL[- ]\d{3,4}G[W]?\b', re.I)


def norm(value):
    return re.sub(r'[^a-z0-9가-힣]+', '', unicodedata.normalize('NFKC', value).casefold())


def tokens(title):
    return sorted({norm(match.group()) for match in TOKEN.finditer(unicodedata.normalize('NFKC', title))})


def disposition(title):
    if re.search(r'래플|응모|추첨|경품', title, re.I):
        return '일반 판매 제외', '래플·추첨·경품 글은 구매가 비교에서 제외'
    peripheral = re.search(r'스피커|SPEAKER|키보드|마우스|헤드셋|이어폰', title, re.I)
    explicit_pc = re.search(r'완\s*본체|반\s*본체|조립\s*PC|컴퓨터\s*본체', title, re.I)
    if peripheral and not explicit_pc:
        return '분류 재검토', '주변기기의 데스크톱·PC 표기를 본체로 오인할 수 있음'
    return '상품 후보', '정확한 모델·옵션·판매자·보증은 별도 확인'


def in_window(row, since, until):
    try:
        lower = datetime.fromisoformat(row['posted_lower'])
        upper = datetime.fromisoformat(row['posted_upper'])
        if lower.tzinfo is None or upper.tzinfo is None or upper <= lower:
            return '날짜 검토'
        return '기간 내' if lower < until and upper > since else '기간 밖'
    except (KeyError, TypeError, ValueError):
        return '날짜 검토'


def review(row, products):
    title = row['title']
    category = row['category']
    state, reason = disposition(title)
    match = re.match(r'^\[([^]]+)\]', title)
    market_raw = match[1] if match else '미표기'
    market = MARKETS.get(market_raw, market_raw)
    eligible = [p for p in products if p['category'] == category]
    related = []
    if state == '상품 후보':
        title_norm = norm(title)
        title_tokens = set(tokens(title))
        for product in eligible:
            product_name = norm(product['name'])
            # A CPU mentioned inside a full-PC offer never becomes a standalone-CPU match.
            if (len(product_name) >= 8 and product_name in title_norm) or title_tokens.intersection(tokens(product['name'])):
                related.append(product['referenceCode'])
    status = ('검토 제외' if state != '상품 후보' else '구성·묶음 대조 필요' if category == 'bundle' else '분류 미등록' if not eligible else '관련 항목 있음·옵션 대조 필요' if related else '제목 일치 미확인·추가 조사')
    priority = ('제외·재분류' if state != '상품 후보' else '높음' if not eligible or category in ('motherboard','psu','fullpc','halfpc') else '보통')
    flags = [label for label, pattern in HINTS if re.search(pattern, title, re.I)]
    truncated = bool(re.search(r'(?:\.\.\.|…)$', title))
    return {
        'id': f"{row['source']}:{row['post_id']}", 'category': category, 'category_label': LABELS.get(category,category),
        'title': title, 'market': market, 'market_raw': market_raw, 'post_url': row['post_url'],
        'posted_lower': row.get('posted_lower'), 'posted_upper': row.get('posted_upper'), 'date_precision': row.get('date_precision'),
        'original_observed_at': row.get('reported_observed_at'), 'reported_price_text': row.get('reported_price_text'),
        'disposition': state, 'reason': reason, 'gap_state': status, 'related_reference_codes': related,
        'title_model_tokens': tokens(title), 'title_discount_hints': flags, 'title_truncated': truncated,
        'priority': priority, 'review_status':'미검토', 'current_price':None, 'sku_verified':False,
        'next_action': ('원문 종류·분류 확인' if state != '상품 후보' else '제조사 모델/품번 → 실제 판매 옵션/판매자/보증 → 행사 원문·배송·결제 조건 확인'),
    }


def build(root=ROOT, since=None, until=None):
    now = datetime.now(KST)
    index = now.year * 12 + now.month - 1 - 6
    year, month = divmod(index, 12)
    since = since or datetime(year, month + 1, min(now.day, calendar.monthrange(year, month + 1)[1]), tzinfo=KST)
    until = until or now
    if since.tzinfo is None or until.tzinfo is None or since >= until:
        raise ValueError('INVALID_REVIEW_WINDOW')
    source_path = root/'ops/private/catalog-review/candidates.local.json'
    source_bytes = source_path.read_bytes()
    raw = json.loads(source_bytes.decode('utf-8-sig'))
    products = json.loads((root/'src/content/products/catalog.json').read_text(encoding='utf-8-sig'))['products']
    note_file = root/'ops/hotdeals/event-notes-2026-11-21.json'
    reviewed_urls = {item['url'] for item in json.loads(note_file.read_text(encoding='utf-8-sig')).get('post_cases',[])} if note_file.exists() else set()
    result = []
    outside = 0
    for row in raw:
        window = in_window(row,since,until)
        if window == '기간 밖':
            outside += 1
            continue
        item = review(row,products)
        if item['post_url'] in reviewed_urls:
            item['review_status'] = '원문 검토'
        item['window_state'] = window
        result.append(item)
    def order(row):
        try: timestamp = datetime.fromisoformat(row['posted_lower']).timestamp()
        except (ValueError, TypeError): timestamp = 0
        return row['priority'] != '높음', row['disposition'] != '상품 후보', row['category'], -timestamp, row['id']
    result.sort(key=order)
    counts = Counter(row['category'] for row in result if row['disposition'] == '상품 후보')
    summary = {'generated_at':now.isoformat(),'since':since.isoformat(),'until':until.isoformat(),
               'input_posts':len(raw),'input_sha256':hashlib.sha256(source_bytes).hexdigest(),'outside_window':outside,
               'review_rows':len(result),'sale_candidates':sum(row['disposition']=='상품 후보' for row in result),
               'excluded_raffle':sum(row['disposition']=='일반 판매 제외' for row in result),
               'reclassify':sum(row['disposition']=='분류 재검토' for row in result),
               'category_gaps':[{'category':category,'label':label,'catalog_entries':sum(p['category']==category for p in products),'deal_posts':counts[category]} for category,label in LABELS.items()],
               'gap_states':dict(Counter(row['gap_state'] for row in result)),
               'markets':dict(Counter(row['market'] for row in result if row['disposition']=='상품 후보')),
               'title_hint_posts':sum(bool(row['title_discount_hints']) for row in result),
               'sku_verified':0,'current_prices_verified':0,'publication_writes':0,
               'limitations':['기간은 게시 시각 구간의 겹침으로 선별. 연도 추론·상대 시각과 원 관측 시각 보존.', '제목 대조는 SKU 검증이나 확정 누락 제품 수가 아님.', '퀘이사존 공개 목록 중심. 뽐뿌 403·쿨엔조이 robots 중단 범위는 완전 수집으로 표시하지 않음.', '본문·행사 조건은 별도 확인한 표본만 검토됨. 모든 글 본문 검토 완료가 아님.']}
    coverage = root/'ops/private/catalog-review/summary.local.json'
    summary['archive_coverage'] = json.loads(coverage.read_text(encoding='utf-8-sig')).get('coverage',[]) if coverage.exists() else []
    destination = root/'ops/private/catalog-review/event-audit'
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'review.generated.local.json').write_text(json.dumps({'summary':summary,'posts':result},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


if __name__ == '__main__':
    print(json.dumps(build(),ensure_ascii=False,indent=2))
