#!/usr/bin/env python3
"""Read-only production health and private recent-deal discovery. Never publishes."""
from __future__ import annotations

import argparse
from datetime import datetime, time, timedelta, timezone
import html
import json
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
OUTPUT = ROOT / 'ops/private/maintenance'
RECENT = ROOT / 'ops/private/hotdeal-watch'
ARCHIVE = ROOT / 'ops/private/hotdeal-research/hotdeals.sqlite3'
ORIGIN = 'https://bluedeal.co.kr'
ROUTES = ('/', '/prices', '/community/hotdeal', '/api/version', '/api/prices/status')
COMPLETE = {'boundary-reached', 'list-end-reached'}
STOPPED = {'access-stopped', 'robots-denied', 'parse-review-needed', 'pagination-stalled', 'date-review-needed'}
FINDING_LABELS = {
    'PRICE_RECHECK_REQUIRED': '실제 판매처에서 다시 확인할 가격이 있습니다.',
    'VERIFIED_MERCHANT_FEED_NOT_CONFIGURED': '동일 상품의 현재 판매가를 검증하는 자동 피드가 아직 연결되지 않았습니다.',
    'DEPLOYED_ARTIFACT_UNAVAILABLE_LOCALLY': '운영 배포의 원본 파일을 로컬에서 확인하지 못했습니다.',
    'DEPLOYED_PRICE_SNAPSHOT_MISMATCH': '운영 가격표와 배포 원본의 해시가 다릅니다.',
    'VERSION_CONTRACT': '운영 버전 응답을 확인해야 합니다.',
    'SNAPSHOT_CONTRACT': '가격표 상태 응답 형식을 확인해야 합니다.',
    'RELEASE_MISMATCH': '버전 API와 가격표 API의 배포 버전이 다릅니다.',
    'HISTORICAL_ARCHIVE_REVIEW': '6개월 과거 자료의 상태를 확인해야 합니다.',
    'HISTORICAL_ARCHIVE_UNREADABLE': '6개월 과거 자료를 읽지 못했습니다.',
    'RECENT_COLLECTION_INCOMPLETE': '최근 핫딜 감시가 끝나지 않았습니다. 출처별 상태를 확인하세요.',
    'RECENT_COLLECTION_FAILED': '최근 핫딜 감시 프로그램 실행을 확인해야 합니다.',
    'LOCAL_HEALTH_REPORT_UNREADABLE': '이전 점검 기록을 읽지 못해 새 기록으로 작성했습니다.',
}
sys.path.insert(0, str(ROOT / 'ops/collector'))
from price_snapshot import CATEGORIES, load_price_snapshot, read_snapshot_json


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None


def fetch_public(route):
    if route not in ROUTES: raise ValueError('UNEXPECTED_HEALTH_ROUTE')
    request = urllib.request.Request(ORIGIN + route, headers={'User-Agent': 'BLUEDEAL-Maintenance/0.1 (+https://bluedeal.co.kr/about)', 'Accept': 'application/json,text/html'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        body = response.read(2_000_001)
        if len(body) > 2_000_000: raise ValueError('RESPONSE_TOO_LARGE')
        return {'status': response.status, 'type': response.headers.get_content_type(), 'body': body}


def price_age(items, now):
    result = {'total': len(items), 'stale': 0, 'unknown_time': 0, 'sold_out': 0, 'recheck': []}
    for item in items:
        if item.get('availability') == 'out-of-stock':
            result['sold_out'] += 1
            continue  # Historic sold-out prices stay historic; never advance checkedAt.
        try:
            checked = datetime.fromisoformat(item.get('checkedAt', '').replace('Z', '+00:00'))
            valid = checked.tzinfo is not None and checked <= now
        except (ValueError, TypeError): valid = False
        if not valid:
            result['unknown_time'] += 1; result['recheck'].append(item['id'])
        elif now - checked > timedelta(hours=24):
            result['stale'] += 1; result['recheck'].append(item['id'])
    return result


def production_health(now, fetch=fetch_public, root=ROOT):
    checks = []; failures = []; warnings = []; payloads = {}
    for route in ROUTES:
        try:
            response = fetch(route)
            if response['status'] != 200: raise ValueError('HTTP_STATUS')
            if route.startswith('/api/'):
                if response['type'] != 'application/json': raise ValueError('CONTENT_TYPE')
                data = json.loads(response['body'])
                if not isinstance(data, dict) or data.get('service') != 'BLUEDEAL': raise ValueError('SERVICE_CONTRACT')
                payloads[route] = data
            elif response['type'] != 'text/html' or b'id="main-content"' not in response['body']:
                raise ValueError('PAGE_CONTRACT')
            checks.append({'route': route, 'ok': True})
        except (OSError, ValueError, KeyError, TypeError):
            # Do not save bodies, cookies, titles or the exception text.
            checks.append({'route': route, 'ok': False}); failures.append('PUBLIC_ENDPOINT:' + route)
    version = payloads.get('/api/version', {})
    snapshot = payloads.get('/api/prices/status', {})
    if version and not (re.fullmatch(r'\d+\.\d+\.\d+', str(version.get('version', ''))) and re.fullmatch(r'[a-f0-9]{40}', str(version.get('commit', '')))):
        failures.append('VERSION_CONTRACT')
    fresh = None
    if snapshot:
        categories = snapshot.get('categories')
        if not (snapshot.get('schemaVersion') == 1 and re.fullmatch(r'[a-f0-9]{64}', str(snapshot.get('snapshotHash', ''))) and isinstance(categories, list) and len(categories) == len(CATEGORIES) and all(isinstance(row, dict) and isinstance(row.get('category'), str) and type(row.get('itemCount')) is int and row['itemCount'] >= 0 for row in categories) and {row['category'] for row in categories} == CATEGORIES and snapshot.get('itemCount') == sum(row['itemCount'] for row in categories)):
            failures.append('SNAPSHOT_CONTRACT')
        elif snapshot.get('version') != version.get('version') or snapshot.get('commit') != version.get('commit'):
            failures.append('RELEASE_MISMATCH')
        else:
            try:
                expected = load_price_snapshot(root, version['commit'])
                if expected['snapshotHash'] != snapshot['snapshotHash']:
                    failures.append('DEPLOYED_PRICE_SNAPSHOT_MISMATCH')
                else:
                    items = [item for row in categories for item in read_snapshot_json(root, f"src/content/prices/{row['category']}.json", version['commit'])['items']]
                    fresh = price_age(items, now)
                    if fresh['stale'] or fresh['unknown_time']: warnings.append('PRICE_RECHECK_REQUIRED')
            except (OSError, ValueError, KeyError, TypeError): warnings.append('DEPLOYED_ARTIFACT_UNAVAILABLE_LOCALLY')
    if not (root / 'ops/private/price-feed.local.json').is_file(): warnings.append('VERIFIED_MERCHANT_FEED_NOT_CONFIGURED')
    return {'checks': checks, 'release': {key: version.get(key) for key in ('version', 'commit')}, 'price_freshness': fresh, 'failures': failures, 'warnings': warnings}


def archive_health(path=ARCHIVE):
    if not path.is_file(): return {'state': 'missing'}
    # Read-only SQLite; never creates or resets the six-month archive.
    database = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    try:
        integrity = database.execute('PRAGMA quick_check').fetchone()[0]
        job = database.execute('SELECT id,since,until FROM jobs ORDER BY id DESC LIMIT 1').fetchone()
        if not job: return {'state': 'empty'}
        states = [dict(source=row[0], state=row[1]) for row in database.execute('SELECT source,state FROM progress WHERE job_id=?', (job[0],))]
        count = database.execute("SELECT COUNT(*) FROM job_posts j JOIN deals d USING(source,post_id) WHERE j.job_id=? AND d.category<>'other'", (job[0],)).fetchone()[0]
        return {'state': 'ok' if integrity == 'ok' else 'integrity-failed', 'pc_posts': count, 'window': {'since': job[1], 'until': job[2]}, 'sources': states}
    finally: database.close()


def recent_collection(now, *, directory=RECENT, max_pages=20, store_factory=None, collect=None, exporter=None):
    """Independent rolling 7-day watch; preserves the six-month backfill and its dates."""
    if store_factory is None or collect is None or exporter is None:
        sys.path.insert(0, str(ROOT / 'ops/hotdeals'))
        from store import Store
        from crawler import crawl
        from report import export
        store_factory, collect, exporter = Store, crawl, export
    store = store_factory(directory)
    try:
        job = store.latest_job()
        if job:
            progress = store.progress(job['id'])
            if any(row['state'] in STOPPED for row in progress):
                return {'state': 'review-required', 'sources': [{'source': row['source'], 'state': row['state']} for row in progress]}
            if all(row['state'] in COMPLETE for row in progress):
                if now - datetime.fromisoformat(job['until']) < timedelta(hours=6):
                    return {'state': 'recently-completed', 'summary': store.summary(job['id'])}
                job = None
        if job is None:
            since = datetime.combine(now.date() - timedelta(days=7), time.min, KST)
            job = store.new_job(since, now, ['quasarzone'])
        collect(store, job['id'], max_pages=max_pages, delay=3, only_sources=['quasarzone'])
        summary = exporter(store, job['id'])
        return {'state': 'complete' if summary['all_sources_window_complete'] else 'partial', 'summary': summary}
    finally: store.close()


def save_report(report, directory=OUTPUT):
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / 'last-health.local.json'
    try:
        previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else {}
        if not isinstance(previous, dict): raise ValueError('INVALID_LOCAL_REPORT')
    except (OSError, ValueError):
        previous = {}; report['warnings'].append('LOCAL_HEALTH_REPORT_UNREADABLE')
        if not report['failures']: report['state'] = 'attention'
    codes = sorted(report['failures'] + report['warnings'])
    report['new_findings'] = sorted(set(codes) - set(previous.get('failures', []) + previous.get('warnings', [])))
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=directory, delete=False, suffix='.tmp') as temporary:
        json.dump(report, temporary, ensure_ascii=False, indent=2); temporary.write('\n'); temporary_path = Path(temporary.name)
    temporary_path.replace(target)
    with (directory / 'history.jsonl').open('a', encoding='utf-8') as history:
        history.write(json.dumps({key: report[key] for key in ('checked_at', 'state', 'failures', 'warnings', 'new_findings')}, ensure_ascii=False) + '\n')
    e = html.escape
    fresh = report['production'].get('price_freshness') or {}
    rows = ''.join(f"<tr><td>{e(row['route'])}</td><td>{'정상' if row['ok'] else '확인 필요'}</td></tr>" for row in report['production']['checks'])
    def finding_label(code):
        if code.startswith('PUBLIC_ENDPOINT:'): return '운영 경로 응답 확인 필요: ' + code.split(':', 1)[1]
        return FINDING_LABELS.get(code, code)
    findings = ''.join(f'<li>{e(finding_label(code))}</li>' for code in codes) or '<li>추가 확인 사항 없음</li>'
    state_label = {'ok': '정상', 'attention': '재확인 필요', 'failed': '오류 확인 필요'}[report['state']]
    page = f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>블루딜 운영 점검</title>
<style>body{{background:#060b1a;color:#e8edf8;font:16px/1.8 system-ui;margin:0}}main{{max-width:850px;margin:auto;padding:24px}}section{{border:1px solid #354057;border-radius:16px;padding:24px;margin:20px 0}}a{{color:#9dedff}}td{{padding:6px 20px 6px 0}}li{{overflow-wrap:anywhere}}</style>
<main><h1>블루딜 운영 점검</h1><p>점검 시각 {e(report['checked_at'])} · {e(state_label)}</p><section><h2>운영 사이트</h2><table><thead><tr><th>확인 경로</th><th>결과</th></tr></thead><tbody>{rows}</tbody></table></section>
<section><h2>가격 재확인</h2><p>24시간 경과 {fresh.get('stale', '미확인')}개 · 확인 시각 누락 {fresh.get('unknown_time', '미확인')}개 · 품절 기록 {fresh.get('sold_out', '미확인')}개</p><p>점검 실행은 실제 판매가 확인이 아닙니다. 가격과 기존 확인 시각을 변경하지 않습니다.</p></section>
<section><h2>확인할 항목</h2><ul>{findings}</ul></section><section><h2>수집 자료</h2><p>6개월 과거 자료와 최근 7일 감시 자료를 별도로 보존합니다. 게시글의 금액은 현재 판매가가 아닙니다.</p><a href="../hotdeal-watch/exports/report.html">최근 감시 결과</a> · <a href="../hotdeal-watch/exports/verification-queue.csv">최근 상품 검증 대기표</a> · <a href="../hotdeal-research/exports/report.html">6개월 과거 조사</a></section></main></html>'''
    (directory / 'report.html').write_text(page, encoding='utf-8')


def main(argv=None):
    parser = argparse.ArgumentParser(description='블루딜 운영 점검·최근 핫딜 감시 (게시·가격 갱신 없음)')
    parser.add_argument('--collect', action='store_true', help='허용된 공개 목록의 최근 7일을 별도 보관함에 수집')
    args = parser.parse_args(argv)
    now = datetime.now(KST)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # Reuse the existing OS lock to prevent overlapping scheduled/manual runs.
    sys.path.insert(0, str(ROOT / 'ops/hotdeals'))
    from crawler import CrawlLock
    try:
        with CrawlLock(OUTPUT):
            production = production_health(now)
            report = {'checked_at': now.isoformat(), 'production': production, 'archive': {}, 'recent': {'state': 'not-requested'}, 'failures': list(production['failures']), 'warnings': list(production['warnings'])}
            try:
                report['archive'] = archive_health()
                if report['archive']['state'] != 'ok': report['warnings'].append('HISTORICAL_ARCHIVE_REVIEW')
            except (OSError, sqlite3.Error): report['failures'].append('HISTORICAL_ARCHIVE_UNREADABLE')
            if args.collect:
                try:
                    report['recent'] = recent_collection(now)
                    if report['recent']['state'] not in ('complete', 'recently-completed'): report['warnings'].append('RECENT_COLLECTION_INCOMPLETE')
                except (OSError, ValueError, sqlite3.Error): report['failures'].append('RECENT_COLLECTION_FAILED')
            report['state'] = 'failed' if report['failures'] else 'attention' if report['warnings'] else 'ok'
            save_report(report)
            print(json.dumps({key: report[key] for key in ('checked_at', 'state', 'failures', 'warnings', 'new_findings')}, ensure_ascii=False))
            return 2 if report['failures'] else 1 if report['warnings'] else 0
    except ValueError:
        print('다른 운영 점검이 실행 중입니다.', file=sys.stderr); return 3


if __name__ == '__main__': raise SystemExit(main())
