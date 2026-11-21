#!/usr/bin/env python3
"""Standalone scheduled operations. No model, Codex, account, or publishing calls."""
from __future__ import annotations

import argparse
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
from pathlib import Path
import shutil
import sqlite3
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
sys.path.insert(0, str(ROOT / 'ops/hotdeals'))
from crawler import CrawlLock
import run as maintenance

BACKUP_LIMIT_BYTES = 1024 * 1024 * 1024


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=path.parent, delete=False, suffix='.tmp') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2); stream.write('\n'); temporary = Path(stream.name)
    temporary.replace(path)


def private_path(root, relative):
    base = (root / 'ops/private').resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base) or target == base:
        raise ValueError('PRIVATE_PATH_OUTSIDE_WORKSPACE')
    return target


def backup_data(root=ROOT, now=None):
    now = now or datetime.now(KST)
    directory = private_path(root, 'maintenance/backups')
    directory.mkdir(parents=True, exist_ok=True)
    used = sum(path.stat().st_size for path in directory.rglob('*') if path.is_file())
    sources = [(name, private_path(root, f'{name}/hotdeals.sqlite3')) for name in ('hotdeal-research', 'hotdeal-watch')]
    missing = [name for name, path in sources if not path.is_file()]
    if missing: return {'state': 'attention', 'warnings': ['BACKUP_SOURCE_MISSING'], 'missing_sources': missing, 'failures': []}
    estimated = sum(path.stat().st_size + (Path(str(path) + '-wal').stat().st_size if Path(str(path) + '-wal').is_file() else 0) for _, path in sources)
    if used + estimated > BACKUP_LIMIT_BYTES:
        return {'state': 'attention', 'warnings': ['BACKUP_STORAGE_REVIEW'], 'failures': [], 'automatic_deletion': False}
    bundle = directory / (now.strftime('%Y%m%dT%H%M%S%f') + '-' + uuid.uuid4().hex[:8])
    bundle.mkdir()
    entries = []
    # SQLite's online backup includes committed WAL data without copying a live DB file.
    for name, source in sources:
        target = bundle / (name + '.sqlite3')
        original = sqlite3.connect(source.as_uri() + '?mode=ro', uri=True, timeout=15)
        saved = sqlite3.connect(target)
        try:
            original.backup(saved, pages=256, sleep=0.05)
            if saved.execute('PRAGMA quick_check').fetchone()[0] != 'ok': raise ValueError('BACKUP_INTEGRITY_FAILED')
            tables = {row[0] for row in saved.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not {'jobs', 'deals', 'job_posts'} <= tables: raise ValueError('BACKUP_SCHEMA_FAILED')
            entries.append({'file': target.name, 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'integrity': 'ok'})
        finally: saved.close(); original.close()
    health = private_path(root, 'maintenance/last-health.local.json')
    if health.is_file():
        target = bundle / health.name; shutil.copyfile(health, target)
        entries.append({'file': target.name, 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    manifest = {'created_at': now.isoformat(), 'state': 'verified', 'files': entries, 'scope': 'research databases and public-health report only', 'automatic_deletion': False}
    atomic_json(bundle / 'manifest.local.json', manifest)
    return {'state': 'ok', 'warnings': [], 'failures': [], 'bundle': bundle.name, 'files': entries, 'restore_verified': 'SQLite opened and quick_check passed; primary files untouched'}


def execute(mode, *, root=ROOT, health_runner=None, now=None):
    started = now or datetime.now(KST)
    record = {'mode': mode, 'run_id': uuid.uuid4().hex, 'started_at': started.isoformat(), 'ai_calls': 0, 'external_writes': False}
    if mode == 'backup':
        detail = backup_data(root, started); record.update(state=detail['state'], detail=detail, application_exit_code=0 if detail['state'] == 'ok' else 1)
    else:
        runner = health_runner or maintenance.main
        with redirect_stdout(io.StringIO()): code = runner(['--collect'] if mode == 'collect' else [])
        record['application_exit_code'] = code
        if code == 3: record.update(state='skipped', reason='another maintenance run is active')
        elif code in (0, 1):
            report = json.loads(private_path(root, 'maintenance/last-health.local.json').read_text(encoding='utf-8'))
            checked = datetime.fromisoformat(report['checked_at'])
            if checked.tzinfo is None or checked < started - timedelta(seconds=2) or report['failures']:
                raise ValueError('SCHEDULED_REPORT_NOT_CURRENT_OR_FAILED')
            record.update(state=report['state'], detail={key: report[key] for key in ('checked_at', 'failures', 'warnings', 'new_findings')})
            if mode == 'collect':
                record['collection_state'] = report['recent']['state']
                from candidate_index import build_index
                index = build_index(root)
                record['catalog_review'] = {key: index[key] for key in ('state', 'baseline_listings', 'internal_models', 'unique_pc_posts', 'duplicate_post_rows_removed')}
        else: record.update(state='failed', reason='maintenance program failed')
    record['completed_at'] = datetime.now(KST).isoformat()
    return record


def save_run(record, root=ROOT):
    directory = private_path(root, 'maintenance/scheduler')
    file = f"{record['mode']}-{record['run_id']}.local.json"
    atomic_json(directory / 'runs' / file, record)
    atomic_json(directory / f"last-{record['mode']}.local.json", record)
    return file


def render_dashboard(root=ROOT):
    directory = private_path(root, 'maintenance')
    import html
    rows = []
    labels = {'health': '사이트 상태 확인 · 30분마다', 'collect': '최근 핫딜 감시 · 09시 / 17시', 'backup': '조사 자료 백업 · 매일 02시'}
    states = {'ok': '정상', 'attention': '재확인 사항 있음', 'failed': '실행 오류', 'skipped': '다른 점검 실행 중'}
    for mode, label in labels.items():
        path = directory / 'scheduler' / f'last-{mode}.local.json'
        try: data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError): data = {}
        rows.append(f"<tr><td>{html.escape(label)}</td><td>{states.get(data.get('state'), '첫 실행 대기')}</td><td>{html.escape(data.get('completed_at', '미실행'))}</td></tr>")
    page = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>블루딜 자동 관리</title>
<style>body{background:#060b1a;color:#e8edf8;font:16px/1.8 system-ui;margin:0}main{max-width:950px;margin:auto;padding:24px}section{border:1px solid #354057;border-radius:16px;padding:20px;margin:20px 0}a{color:#9dedff}table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid #354057;overflow-wrap:anywhere}.scroll{overflow:auto}</style>
<main><h1>블루딜 자동 관리</h1><p>AI를 호출하지 않는 프로그램의 실행 기록입니다. 이 PC가 켜져 있고 Windows에 로그인돼 있어야 합니다.</p><section><h2>최근 실행</h2><div class="scroll"><table><thead><tr><th>작업·예약 주기</th><th>결과</th><th>완료 시각 KST</th></tr></thead><tbody>''' + ''.join(rows) + '''</tbody></table></div></section><section><h2>운영 점검</h2><a href="report.html">사이트 상태·가격 재확인 목록 보기</a><p>현재 판매가를 검증하는 자동 피드는 아직 연결되지 않았습니다. 점검 시각과 상품 가격 확인 시각은 다릅니다.</p></section><section><h2>수집 자료</h2><a href="../hotdeal-watch/exports/report.html">최근 핫딜 후보</a> · <a href="../hotdeal-research/exports/report.html">6개월 과거 조사</a> · <a href="../catalog-review/report.html">통합 상품 검토</a><p>게시글 표기 가격을 현재 판매가로 사용하지 않습니다. 접근 차단·출처 규정은 우회하지 않습니다.</p></section><section><h2>백업·오류 처리</h2><p>백업은 조사 데이터베이스와 공개 상태 보고서만 포함합니다. 계정 보관함·환경변수 파일은 포함하지 않습니다. 원본을 바꾸지 않고 백업 SQLite 열기·무결성을 확인합니다. 백업 저장량이 1GiB에 도달하면 정리 검토 대상으로 기록하며 임의 삭제하지 않습니다.</p><p>재확인 안내와 실행 오류를 구분해 기록합니다. 새 오류의 AI 자동 호출은 연결하지 않았으며, 분석·수정이 필요한 경우 이 실행 기록을 확인합니다.</p></section></main></html>'''
    (directory / 'dashboard.html').write_text(page, encoding='utf-8')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Independent BLUEDEAL maintenance task')
    parser.add_argument('mode', choices=('health', 'collect', 'backup'))
    args = parser.parse_args(argv)
    directory = private_path(ROOT, 'maintenance/scheduler'); directory.mkdir(parents=True, exist_ok=True)
    try:
        with CrawlLock(directory):
            try: record = execute(args.mode)
            except Exception as error:
                record = {'mode': args.mode, 'run_id': uuid.uuid4().hex, 'state': 'failed', 'completed_at': datetime.now(KST).isoformat(), 'error_class': type(error).__name__, 'ai_calls': 0, 'external_writes': False}
            save_run(record); render_dashboard()
            print(json.dumps({key: record[key] for key in ('mode', 'run_id', 'state', 'ai_calls')}, ensure_ascii=False))
            return 2 if record['state'] == 'failed' else 0
    except ValueError:
        print(json.dumps({'mode': args.mode, 'state': 'skipped', 'reason': 'another scheduled operation is active'})); return 0


if __name__ == '__main__': raise SystemExit(main())
