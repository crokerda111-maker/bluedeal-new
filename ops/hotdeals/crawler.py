"""Public-HTML backfill. No login, browser impersonation, proxy rotation or publishing."""
from __future__ import annotations

from datetime import datetime
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

from parsers import KST,PARSERS,detail_posted_at,page_url
from robots import RobotsPolicy

USER_AGENT='BLUEDEAL-Research/0.1 (+https://bluedeal.co.kr/about)'
SOURCES={
    'quasarzone':{'name':'퀘이사존','url':'https://quasarzone.com/bbs/qb_saleinfo','commercial_reuse_review_required':True,'terms_url':'https://quasarzone.com/terms_of_use'},
    'coolenjoy':{'name':'쿨엔조이','url':'https://coolenjoy.net/bbs/jirum'},
    'ppomppu':{'name':'뽐뿌','url':'https://www.ppomppu.co.kr/zboard/zboard.php?id=ppomppu&category=4'},
}


class CrawlStop(Exception): pass
class NetworkPause(CrawlStop): pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None


class Transport:
    def __init__(self,origin,stop=None,delay=3.0):
        self.origin=origin
        self.stop=stop or threading.Event()
        self.delay=max(3.0,delay)
        self.last_request=0.0
        self.policy=None
        self.opener=urllib.request.build_opener(NoRedirect())

    def get(self,url,*,robots=False):
        for redirect_count in range(4):
            parts=urlsplit(url)
            if parts.scheme!='https' or parts.username or parts.password or parts.port or f'{parts.scheme}://{parts.netloc}'!=self.origin:
                raise CrawlStop('다른 출처로의 이동은 허용하지 않습니다.')
            if not robots and (not self.policy or not self.policy.allowed(url)):
                raise CrawlStop('robots.txt가 해당 주소를 허용하지 않습니다.')
            if self.stop.wait(max(0,self.delay-(time.monotonic()-self.last_request))):
                raise CrawlStop('사용자가 중지했습니다. 다음 실행에서 재개할 수 있습니다.')
            request=urllib.request.Request(url,headers={'User-Agent':USER_AGENT,'Accept':'text/html,text/plain;q=0.9'})
            self.last_request=time.monotonic()
            try:
                with self.opener.open(request,timeout=25) as response:
                    raw=response.read(3_000_001)
                    if len(raw)>3_000_000: raise CrawlStop('응답 크기 제한을 넘었습니다.')
                    kind=response.headers.get_content_type()
                    if kind not in ('text/html','text/plain','application/xhtml+xml'):
                        raise CrawlStop('HTML/텍스트가 아닌 응답입니다.')
                    charset=response.headers.get_content_charset()
                    if charset:
                        return raw.decode(charset,errors='replace')
                    # Beautiful Soup reads declared HTML meta encodings, including EUC-KR.
                    from bs4 import UnicodeDammit
                    decoded=UnicodeDammit(raw,is_html=not robots).unicode_markup
                    if decoded is None: raise CrawlStop('문자 인코딩을 확인하지 못했습니다.')
                    return decoded
            except urllib.error.HTTPError as error:
                if error.code in (301,302,303,307,308):
                    from urllib.parse import urljoin
                    url=urljoin(url,error.headers.get('Location',''))
                    if redirect_count==3: raise CrawlStop('이동 횟수가 너무 많습니다.')
                    continue
                if robots and error.code==404: return ''
                if error.code in (401,403,429):
                    raise CrawlStop(f'HTTP {error.code}: 출처가 접근을 제한했습니다. 우회·자동 재시도하지 않습니다.') from None
                raise CrawlStop(f'HTTP {error.code}: 다음 페이지를 요청하지 않았습니다.') from None
            except (urllib.error.URLError,TimeoutError,OSError):
                raise NetworkPause('네트워크 응답을 확인하지 못했습니다. 다음 예약 실행에서 재개합니다.') from None
        raise CrawlStop('주소 이동을 완료하지 못했습니다.')

    def load_robots(self):
        text=self.get(self.origin+'/robots.txt',robots=True)
        self.policy=RobotsPolicy(text,USER_AGENT)
        self.delay=max(self.delay,self.policy.delay)
        return self.policy


class CrawlLock:
    def __init__(self,directory): self.file=directory/'crawl.lock';self.handle=None
    def __enter__(self):
        self.handle=self.file.open('a+b')
        if self.file.stat().st_size==0: self.handle.write(b'0');self.handle.flush()
        self.handle.seek(0)
        try:
            import os
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            self.handle.close();raise ValueError('다른 수집 프로세스가 실행 중입니다. 기존 수집을 먼저 중지하세요.') from None
        return self
    def __exit__(self,*_): self.handle.close()


def crawl(store,job_id,**options):
    with CrawlLock(store.directory): return _crawl(store,job_id,**options)


def _crawl(store,job_id,*,max_pages=1500,delay=3.0,stop=None,transport_factory=Transport,on_page=None,only_sources=None):
    stop=stop or threading.Event()
    for progress in store.progress(job_id):
        source=progress['source']
        if only_sources and source not in only_sources: continue
        if source not in SOURCES:
            store.mark(job_id,source,'unsupported','현재 버전에서 검증한 출처 어댑터가 없습니다.');continue
        if progress['state'] in ('boundary-reached','list-end-reached'):
            continue
        config=SOURCES[source]
        p=urlsplit(config['url']);transport=transport_factory(f'{p.scheme}://{p.netloc}',stop,delay)
        try:
            if stop.is_set(): raise CrawlStop('사용자가 중지했습니다.')
            policy=transport.load_robots()
            if not policy.allowed(config['url']):
                store.mark(job_id,source,'robots-denied','robots.txt가 자동 수집을 허용하지 않습니다.');continue
            store.mark(job_id,source,'running')
            start_page=progress['next_page']
            for page in range(start_page,start_page+max_pages):
                if stop.is_set(): raise CrawlStop('사용자가 중지했습니다. 다음 실행에서 재개할 수 있습니다.')
                html=transport.get(page_url(source,config['url'],page))
                rows,next_url=PARSERS[source](html,datetime.now(KST),page)
                state=store.ingest_page(job_id,source,page,rows,has_next=next_url is not None)
                if state=='boundary-reached' and source=='quasarzone' and any(row['date_precision']=='day-year-inferred' for row in rows):
                    anchor=next(row for row in rows if row['date_precision']=='day-year-inferred')
                    published=detail_posted_at(transport.get(anchor['post_url']),anchor['post_url'])
                    expected=datetime.fromisoformat(anchor['posted_lower']).date()
                    if published is None or published.date()!=expected:
                        state='date-review-needed';store.mark(job_id,source,state,'기간 경계 게시글의 연도를 확인하지 못했습니다. 월·일 표기를 확정된 연도로 간주하지 않습니다.')
                    else:
                        with store.db:
                            store.db.execute('INSERT OR REPLACE INTO date_anchors VALUES(?,?,?,?,?)',(job_id,source,anchor['post_url'],published.isoformat(),datetime.now(KST).isoformat()))
                        store.mark(job_id,source,state,'기간 경계 글의 연도를 원문의 게시 시각으로 확인했습니다. 개별 목록의 월·일은 연도 보완 표기를 유지합니다.')
                if on_page: on_page(store.summary(job_id))
                if state!='running': break
            else:
                store.mark(job_id,source,'page-budget-paused','이번 실행의 페이지 한도에 도달했습니다. 재개하면 다음 페이지부터 이어갑니다.')
        except NetworkPause as error:
            store.mark(job_id,source,'network-paused',str(error))
        except CrawlStop as error:
            store.mark(job_id,source,'stopped' if stop.is_set() else 'access-stopped',str(error))
        except (ValueError,UnicodeError):
            store.mark(job_id,source,'parse-review-needed','목록 구조·날짜·출처를 확인하지 못했습니다. 현재 페이지에서 멈췄습니다.')
        if stop.is_set(): break
    summary=store.summary(job_id)
    with store.db:
        store.db.execute('UPDATE jobs SET state=? WHERE id=?',('complete' if summary['all_sources_window_complete'] else 'partial',job_id))
    return store.summary(job_id)
