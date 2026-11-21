#!/usr/bin/env python3
"""BLUEDEAL historical hot-deal research CLI."""
from __future__ import annotations

import argparse
import calendar
from datetime import date,datetime,time,timedelta
import json
from pathlib import Path
import sys

from crawler import SOURCES,crawl
from parsers import KST,PARSERS
from report import export
from store import DEFAULT_DATA,Store


def six_month_window(now):
    now=now.astimezone(KST)
    index=now.year*12+now.month-1-6;year,month=divmod(index,12);month+=1
    day=min(now.day,calendar.monthrange(year,month)[1])
    return datetime(year,month,day,tzinfo=KST),now


def ensure_job(store,*,new=False,sources=None,since=None,until=None):
    existing=store.latest_job()
    if existing and not new:
        if since or until: raise ValueError('기존 작업의 기간은 유지됩니다. 새 기간은 --new와 함께 지정하세요.')
        if sources and set(sources)!={row['source'] for row in store.progress(existing['id'])}: raise ValueError('출처를 변경하려면 --new로 새 작업을 만드세요.')
        return existing
    now=datetime.now(KST);start,end=six_month_window(now)
    if since: start=datetime.combine(date.fromisoformat(since),time.min,KST)
    if until: end=min(datetime.combine(date.fromisoformat(until)+timedelta(days=1),time.min,KST),now)
    return store.new_job(start,end,sources or list(SOURCES))


def main(argv=None):
    parser=argparse.ArgumentParser(description='최근 6개월 PC 핫딜 메타데이터 수집·검토 도구 (운영 게시 없음)')
    parser.add_argument('--data-dir',default=str(DEFAULT_DATA))
    sub=parser.add_subparsers(dest='command',required=True)
    for name in ['init','crawl']:
        item=sub.add_parser(name);item.add_argument('--new',action='store_true');item.add_argument('--sources',nargs='+',choices=list(SOURCES));item.add_argument('--since');item.add_argument('--until')
        if name=='crawl': item.add_argument('--max-pages',type=int,default=1500);item.add_argument('--delay',type=float,default=3);item.add_argument('--only',nargs='+',choices=list(SOURCES))
    sub.add_parser('status');sub.add_parser('report');sub.add_parser('reclassify')
    item=sub.add_parser('import-html');item.add_argument('--source',choices=list(PARSERS),required=True);item.add_argument('--input',type=Path,required=True);item.add_argument('--observed-at',required=True);item.add_argument('--page',type=int,default=1)
    args=parser.parse_args(argv)
    store=Store(args.data_dir)
    try:
        if args.command in ('init','crawl'):
            job=ensure_job(store,new=args.new,sources=args.sources,since=args.since,until=args.until)
            if args.command=='crawl':
                if not 1<=args.max_pages<=10000 or not 3<=args.delay<=300: raise ValueError('페이지 한도는 1~10000, 요청 간격은 3~300초로 지정하세요.')
                def progress(summary):
                    pages=sum(p['pages'] for p in summary['pages'] if p['mode']=='live')
                    if pages%10==0: print(json.dumps({'live_pages':pages,'pc_posts':summary['classified_pc_posts']},ensure_ascii=False),flush=True)
                if args.only and not set(args.only)<={row['source'] for row in store.progress(job['id'])}: raise ValueError('등록되지 않은 출처입니다. 새 작업에 해당 출처를 추가하세요.')
                crawl(store,job['id'],max_pages=args.max_pages,delay=args.delay,on_page=progress,only_sources=args.only)
        else:
            job=ensure_job(store)
            if args.command=='reclassify':
                from crawler import CrawlLock
                import sqlite3
                with CrawlLock(store.directory):
                    backup_file=store.directory/('before-reclassify-'+datetime.now(KST).strftime('%Y%m%dT%H%M%S%f')+'.sqlite3')
                    backup=sqlite3.connect(backup_file)
                    try: store.db.backup(backup)
                    finally: backup.close()
                    store.reclassify(job['id'])
            if args.command=='import-html':
                observed=datetime.fromisoformat(args.observed_at.replace('Z','+00:00'))
                if observed.tzinfo is None or observed>datetime.now(KST) or args.page<1: raise ValueError('실제 수집 시각(시간대 포함)과 올바른 페이지가 필요합니다.')
                if args.input.stat().st_size>3_000_000: raise ValueError('입력 HTML 크기 제한을 넘었습니다.')
                html=args.input.read_text(encoding='utf-8-sig')
                rows,_=PARSERS[args.source](html,observed,args.page)
                store.ingest_page(job['id'],args.source,args.page,rows,mode='import')
        summary=export(store,job['id'])
        print(json.dumps(summary,ensure_ascii=False,indent=2))
        return 0
    except KeyboardInterrupt:
        if store.latest_job():
            latest=store.latest_job()
            for progress in store.progress(latest['id']):
                if progress['state']=='running': store.mark(latest['id'],progress['source'],'stopped','사용자가 중지했습니다. 마지막 저장 페이지 다음부터 재개할 수 있습니다.')
            with store.db: store.db.execute("UPDATE jobs SET state='partial' WHERE id=?",(latest['id'],))
            export(store,latest['id'])
        print('중지했습니다. 다음 실행에서 마지막 저장 페이지 다음부터 재개합니다.',file=sys.stderr)
        return 130
    except (ValueError,OSError) as error:
        print(str(error),file=sys.stderr);return 2
    finally: store.close()


if __name__=='__main__': raise SystemExit(main())
