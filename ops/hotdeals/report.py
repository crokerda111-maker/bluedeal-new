"""Local review UI and spreadsheet-safe exports; never publishes to BLUEDEAL."""
from __future__ import annotations

from collections import Counter
import csv
from decimal import Decimal
import html
import io
import json
from pathlib import Path
import tempfile
from urllib.parse import urlencode

from parsers import CATEGORY_LABELS

STATES={'pending':'대기','running':'수집 중','imported-partial':'샘플 분석 · 기간 미충족','robots-denied':'자동 수집 제한','provider-consent-required':'출처 이용 동의 확인 필요','access-stopped':'접근 제한으로 중지','stopped':'중지 · 재개 가능','parse-review-needed':'목록 구조 확인 필요','pagination-stalled':'페이지 이동 확인 필요','page-budget-paused':'이번 실행 한도 · 재개 가능','date-review-needed':'날짜 확인 필요','boundary-reached':'요청 기간 경계 도달','list-end-reached':'공개 목록 끝 도달','unsupported':'지원 전 출처'}
STATES['network-paused']='네트워크 대기 · 다음 예약 실행에서 재개'
SOURCE_NAMES={'quasarzone':'퀘이사존','coolenjoy':'쿨엔조이','ppomppu':'뽐뿌'}
DATE_LABELS={'relative_hour':'시간 단위 범위','relative_minute':'분 단위 범위','relative_day':'일 단위 범위','day':'일 단위','day-year-inferred':'목록의 월·일 · 연도 보완','minute':'분 단위','second':'초 단위','unknown':'게시일 확인 필요'}
NOTE='가격은 수집 시점에 게시글 목록에서 읽은 표기값입니다. 글 수정 가능성이 있으며 실제 결제 가격·현재 판매가·현재 재고를 뜻하지 않습니다.'


def escaped(value): return html.escape(str(value if value is not None else ''),quote=True)


def money(row):
    if row.get('offer_kind')=='raffle': return '추첨·응모 조건 확인'
    if row.get('offer_kind')=='multiple': return '복수 상품 · 개별가 확인'
    if row.get('price_amount') and row.get('currency'):
        return f"{row['currency']} {Decimal(row['price_amount']):,}"
    return '금액 확인 필요'


def safe_cell(value):
    text=str(value if value is not None else '')
    return "'"+text if text.lstrip().startswith(('=','+','-','@')) or text.startswith(('\t','\r','\n')) else text


def csv_text(columns,rows):
    out=io.StringIO(newline='');writer=csv.DictWriter(out,fieldnames=columns,extrasaction='ignore');writer.writeheader()
    for row in rows: writer.writerow({key:safe_cell(row.get(key)) for key in columns})
    return '\ufeff'+out.getvalue()


def render(summary,records,*,q='',category='',page=1,csrf=None,running=False,message='',can_stop=True):
    q=q.strip()[:200]
    filtered=[row for row in records if (not category or row['category']==category) and (not q or q.casefold() in row['title'].casefold())]
    page=max(1,page);page_size=100;visible=filtered[(page-1)*page_size:page*page_size]
    job=summary['job'];completed=summary['all_sources_window_complete']
    pills=''.join(f'<span class="pill">{escaped(CATEGORY_LABELS.get(key,key))} {value:,}</span>' for key,value in sorted(summary['category_counts'].items()))
    source_rows=[]
    for source in summary['sources']:
        counts=[p for p in summary['pages'] if p['source']==source['source']]
        live=sum(p['pages'] for p in counts if p['mode']=='live');imported=sum(p['pages'] for p in counts if p['mode']=='import')
        source_rows.append(f'<tr><td>{escaped(SOURCE_NAMES.get(source["source"],source["source"]))}</td><td>{escaped(STATES.get(source["state"],source["state"]))}</td><td>{live} / 샘플 {imported}</td><td>{source["next_page"]}</td><td>{escaped(source["reason"])}</td></tr>')
    rows=''.join(f'<tr><td><span class="pill">{escaped(CATEGORY_LABELS[row["category"]])}</span></td><td><a href="{escaped(row["post_url"])}" target="_blank" rel="noopener noreferrer nofollow">{escaped(row["title"])}</a><small>{escaped(SOURCE_NAMES.get(row["source"],row["source"]))} · {escaped(row["posted_text"])} · {escaped(DATE_LABELS.get(row["date_precision"],row["date_precision"]))}</small>{"<small>제목 기반 분류 검토 필요</small>" if row["category"]=="other" else ""}{"<small>목록의 제목이 생략되어 모델·옵션 확인 필요</small>" if row.get("title_truncated") else ""}</td><td>{escaped(money(row))}<small>원문 표기: {escaped(row.get("price_text") or "미확인")}</small></td><td>{escaped(row.get("shipping_text") or "확인 필요")}</td><td>{"게시글 종료 표시" if row.get("ended") else "현재 재고 미확인"}</td></tr>' for row in visible)
    if not rows: rows='<tr><td colspan="5">표시할 결과가 없습니다. 아래 출처 상태와 수집 범위를 확인하세요.</td></tr>'
    options='<option value="">모든 분류</option>'+''.join(f'<option value="{key}" {"selected" if category==key else ""}>{escaped(label)}</option>' for key,label in CATEGORY_LABELS.items())
    controls=''
    if csrf:
        controls=f'<div class="actions"><form method="post" action="/start"><input type="hidden" name="csrf" value="{escaped(csrf)}"><button {"disabled" if running else ""}>6개월 수집 시작 / 이어서 수집</button></form><form method="post" action="/stop"><input type="hidden" name="csrf" value="{escaped(csrf)}"><button class="secondary" {"" if running and can_stop else "disabled"}>중지</button></form></div>'
    nav=''
    if page>1: nav+=f'<a href="?{urlencode({"q":q,"category":category,"page":page-1})}">← 이전</a> '
    if page*page_size<len(filtered): nav+=f'<a href="?{urlencode({"q":q,"category":category,"page":page+1})}">다음 →</a>'
    filters=f'<form class="filters" method="get"><input aria-label="상품명 검색" name="q" value="{escaped(q)}" placeholder="9800X3D, B850, DDR5 등"><select aria-label="분류" name="category">{options}</select><button>검색</button></form>' if csrf else '<p>저장된 보고서입니다. 검색·분류·이어받기는 수집기 시작 파일로 여는 화면에서 사용할 수 있습니다.</p>'
    export_prefix='/exports/' if csrf else ''
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">{'<meta http-equiv="refresh" content="8">' if running else ''}<title>블루딜 핫딜 수집기</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#09111c;color:#e7eef8;font:15px/1.65 system-ui,'Malgun Gothic',sans-serif}}header{{padding:22px max(20px,calc((100vw - 1180px)/2));border-bottom:1px solid #294158;color:#8ce8f5;font-weight:800}}main{{max-width:1220px;margin:auto;padding:28px 20px 60px}}h1{{font-size:29px;margin:0 0 8px}}h2{{font-size:20px}}p{{color:#bed0e4}}.panel{{background:#111f30;border:1px solid #294158;border-radius:14px;padding:22px;margin:20px 0}}.notice{{border-left:4px solid #e9bc62;background:#2d281d;padding:16px;color:#ffe0a1}}.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}}.metric{{font-size:29px;color:#8ce8f5;font-weight:750}}small{{display:block;color:#b4c6dc;font-size:12px}}.pill{{display:inline-block;background:#20384c;border-radius:7px;padding:3px 9px;margin:3px 5px 3px 0;font-size:12px}}.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;min-width:740px}}td,th{{padding:12px 10px;text-align:left;vertical-align:top;border-bottom:1px solid #294158}}th{{font-size:12px;color:#b4c6dc}}td:nth-child(2){{min-width:250px}}a{{color:#91e6f3;overflow-wrap:anywhere}}button,input,select{{font:inherit;border:1px solid #49657e;border-radius:8px;padding:10px;color:#edf4ff;background:#122b3c}}button{{background:#116277;font-weight:700;cursor:pointer}}button.secondary{{background:#263546}}button:disabled{{opacity:.45;cursor:default}}input{{min-width:0}}.actions,.filters{{display:flex;flex-wrap:wrap;gap:10px;align-items:center}}.actions form{{margin:0}}.filters input{{flex:1}}:focus-visible{{outline:3px solid #a8f0f8;outline-offset:3px}}@media(max-width:600px){{main{{padding:20px 12px}}h1{{font-size:24px}}.panel{{padding:16px}}.grid{{grid-template-columns:1fr}}.metric{{font-size:25px}}}}
</style></head><body><header>BLUEDEAL · 로컬 핫딜 수집기</header><main><h1>6개월 PC 핫딜 조사</h1><p>대상: {escaped(job['since'][:10])} ~ {escaped(job['until'][:10])} KST · CPU / 메인보드 / RAM / 파워 / 완본체 / 반본체 / 그래픽카드 / 저장장치 / 쿨러 / 케이스</p>
<div class="notice"><strong>{'등록한 출처의 공개 목록 탐색을 마쳤습니다.' if completed else '6개월 전체 수집은 아직 완료되지 않았습니다.'}</strong><br>{escaped(NOTE)}<br>제목에서 찾은 모델·분류는 후보입니다. 판매자·옵션·보증·배송비·현재가는 판매처에서 별도로 확인합니다.<br>{escaped(summary.get('commercial_reuse_review',''))}</div>
{controls}<p role="status">{escaped(message or ('수집 중입니다. 진행 상황은 약 8초마다 갱신됩니다.' if running else '상태와 수집 범위를 확인한 뒤 시작하거나 재개할 수 있습니다.'))}</p>
<div class="grid"><div class="panel"><small>분류된 PC 핫딜 게시글</small><div class="metric">{summary['classified_pc_posts']:,}건</div><small>제목 기준 · 분류 검토 포함</small></div><div class="panel"><small>분류 대기 게시글</small><div class="metric">{summary['category_counts'].get('other',0):,}건</div><small>PC 분류의 미인식 제목을 보존</small></div><div class="panel"><small>판매처 현재가 확인</small><div class="metric">0건</div><small>과거 글의 가격을 현재가로 전환하지 않음</small></div></div>
<section class="panel"><h2>출처별 진행 상황</h2><div class="scroll"><table><thead><tr><th>출처</th><th>상태</th><th>목록 페이지</th><th>다음 페이지</th><th>확인 내용</th></tr></thead><tbody>{''.join(source_rows)}</tbody></table></div><p>전체 범위의 누락·삭제·비공개 게시글까지 포함했다고 단정하지 않습니다. 샘플 HTML은 기간 수집 완료의 근거로 사용하지 않습니다. 월·일만 표시된 글 {summary.get('year_inferred_posts',0):,}건은 연도를 보완한 날짜로 구분합니다. 기간 경계의 연도는 원문 게시 시각으로 별도 확인합니다.</p></section>
<section class="panel"><h2>상품 후보 검토</h2><div>{pills}</div>{filters}<p>검색 결과 {len(filtered):,}건 · 페이지 {page} · 한 번에 100건 표시</p><div class="scroll"><table><thead><tr><th>제목 기반 분류</th><th>게시글 / 원문 출처</th><th>게시글 표기 금액</th><th>게시글 배송 표기</th><th>상태</th></tr></thead><tbody>{rows}</tbody></table></div><p>{nav}</p></section>
<section class="panel"><h2>검토 자료 내려받기</h2><p><a href="{export_prefix}deals.csv">게시글 목록 CSV</a> · <a href="{export_prefix}verification-queue.csv">판매처 확인 대기 CSV</a> · <a href="{export_prefix}summary.json">진행 상황 JSON</a></p><p>운영 사이트 게시·가격표 반영·제휴 링크 교체는 이 프로그램에서 실행하지 않습니다.</p></section><small>자료 생성: {escaped(summary['generated_at'])} · 이 PC의 비공개 저장소</small></main></body></html>'''


def export(store,job_id):
    summary=store.summary(job_id);records=store.records(job_id)
    columns=['source','post_id','post_url','title','category','offer_kind','title_truncated','posted_text','posted_lower','posted_upper','date_precision','observed_at','price_text','price_amount','currency','price_basis','shipping_text','ended','window_status','candidate_key']
    queue=[{'source':row['source'],'post_url':row['post_url'],'title':row['title'],'category':row['category'],'retailer_hint':row.get('shop_hint',''),'retailer_url':'','option':'','seller':'','current_price':'','currency':'','shipping_fee':'','stock':'','checked_at':'','verification_status':'판매처 직접 확인 필요'} for row in records if row['category']!='other']
    files={'summary.json':json.dumps(summary,ensure_ascii=False,indent=2)+'\n','deals.csv':csv_text(columns,records),'verification-queue.csv':csv_text(['source','post_url','title','category','retailer_hint','retailer_url','option','seller','current_price','currency','shipping_fee','stock','checked_at','verification_status'],queue),'report.html':render(summary,records)}
    folder=store.directory/'exports';folder.mkdir(exist_ok=True)
    for name,content in files.items():
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='',prefix=name+'.',suffix='.tmp',dir=folder,delete=False) as output:
            output.write(content);temp=Path(output.name)
        temp.replace(folder/name)
    return summary
