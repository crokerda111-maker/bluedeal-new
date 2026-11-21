"""Private SQLite archive, resumable source cursors and source-price observations."""
from __future__ import annotations

from datetime import datetime
import hashlib
import json
from pathlib import Path
import sqlite3

from parsers import KST,interpret,obvious_non_pc

ROOT=Path(__file__).resolve().parents[2]
DEFAULT_DATA=ROOT/'ops/private/hotdeal-research'


def data_directory(value: str|Path=DEFAULT_DATA) -> Path:
    path=Path(value).resolve()
    if not any(path.is_relative_to(root.resolve()) for root in [ROOT/'ops/private',ROOT/'.test-tmp']):
        raise ValueError('수집 자료는 ops/private 또는 .test-tmp 아래에만 저장할 수 있습니다.')
    path.mkdir(parents=True,exist_ok=True)
    return path


def now_iso():
    return datetime.now(KST).isoformat()


def observation_hash(row):
    # Interpretation changes must not invent a new observed source price.
    facts={key:row.get(key) for key in ['title','price_text','shipping_text','ended']}
    return hashlib.sha256(json.dumps(facts,sort_keys=True,ensure_ascii=False).encode()).hexdigest()


class Store:
    def __init__(self,directory=DEFAULT_DATA):
        self.directory=data_directory(directory)
        self.db=sqlite3.connect(self.directory/'hotdeals.sqlite3',timeout=15)
        self.db.row_factory=sqlite3.Row
        self.db.executescript('''
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY,since TEXT NOT NULL,until TEXT NOT NULL,created_at TEXT NOT NULL,state TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS progress(job_id INTEGER NOT NULL,source TEXT NOT NULL,next_page INTEGER NOT NULL DEFAULT 1,state TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL DEFAULT '',older_streak INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(job_id,source),FOREIGN KEY(job_id) REFERENCES jobs(id));
        CREATE TABLE IF NOT EXISTS deals(source TEXT NOT NULL,post_id TEXT NOT NULL,category TEXT NOT NULL,candidate_key TEXT NOT NULL,payload TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,PRIMARY KEY(source,post_id));
        CREATE TABLE IF NOT EXISTS job_posts(job_id INTEGER NOT NULL,source TEXT NOT NULL,post_id TEXT NOT NULL,window_status TEXT NOT NULL,PRIMARY KEY(job_id,source,post_id),FOREIGN KEY(job_id) REFERENCES jobs(id));
        CREATE TABLE IF NOT EXISTS observations(source TEXT NOT NULL,post_id TEXT NOT NULL,fact_hash TEXT NOT NULL,observed_at TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(source,post_id,fact_hash));
        CREATE TABLE IF NOT EXISTS pages(job_id INTEGER NOT NULL,source TEXT NOT NULL,page INTEGER NOT NULL,mode TEXT NOT NULL,signature TEXT NOT NULL,row_count INTEGER NOT NULL,unknown_dates INTEGER NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(job_id,source,page,mode));
        CREATE TABLE IF NOT EXISTS date_anchors(job_id INTEGER NOT NULL,source TEXT NOT NULL,post_url TEXT NOT NULL,published_at TEXT NOT NULL,checked_at TEXT NOT NULL,PRIMARY KEY(job_id,source,post_url));
        ''')

    def close(self): self.db.close()

    def latest_job(self):
        row=self.db.execute('SELECT * FROM jobs ORDER BY id DESC LIMIT 1').fetchone()
        return dict(row) if row else None

    def job(self,job_id):
        row=self.db.execute('SELECT * FROM jobs WHERE id=?',(job_id,)).fetchone()
        if row is None: raise ValueError('수집 작업이 없습니다.')
        return dict(row)

    def new_job(self,since,until,sources):
        if since>=until: raise ValueError('시작일은 종료 시각보다 앞서야 합니다.')
        with self.db:
            cursor=self.db.execute('INSERT INTO jobs(since,until,created_at,state) VALUES(?,?,?,?)',(since.isoformat(),until.isoformat(),now_iso(),'pending'))
            job_id=cursor.lastrowid
            for source in sources:
                self.db.execute('INSERT INTO progress(job_id,source,updated_at) VALUES(?,?,?)',(job_id,source,now_iso()))
        return self.job(job_id)

    def progress(self,job_id):
        return [dict(row) for row in self.db.execute('SELECT * FROM progress WHERE job_id=? ORDER BY source',(job_id,))]

    def mark(self,job_id,source,state,reason=''):
        with self.db:
            self.db.execute('UPDATE progress SET state=?,reason=?,updated_at=? WHERE job_id=? AND source=?',(state,reason[:1000],now_iso(),job_id,source))

    def repeated_page(self,job_id,source,page,signature):
        return self.db.execute("SELECT 1 FROM pages WHERE job_id=? AND source=? AND mode='live' AND page<>? AND signature=?",(job_id,source,page,signature)).fetchone() is not None

    def ingest_page(self,job_id,source,page,rows,*,mode='live',has_next=True):
        if mode not in ('live','import'): raise ValueError('잘못된 입력 방식입니다.')
        if not rows: raise ValueError('목록 구조를 확인하지 못했습니다. 빈 수집을 완료로 처리하지 않습니다.')
        if any(row.get('source')!=source for row in rows): raise ValueError('출처가 섞인 입력입니다.')
        job=self.job(job_id)
        since,until=datetime.fromisoformat(job['since']),datetime.fromisoformat(job['until'])
        observed=max(row['observed_at'] for row in rows)
        signature=hashlib.sha256('|'.join(sorted({row['post_id'] for row in rows})).encode()).hexdigest()
        if mode=='live' and self.repeated_page(job_id,source,page,signature):
            self.mark(job_id,source,'pagination-stalled','서로 다른 페이지가 같은 게시글 목록을 반환했습니다.')
            return 'pagination-stalled'
        unknown=0;all_older=True
        with self.db:
            for row in rows:
                lower=datetime.fromisoformat(row['posted_lower']) if row['posted_lower'] else None
                upper=datetime.fromisoformat(row['posted_upper']) if row['posted_upper'] else None
                if lower is None or upper is None:
                    window='unknown-date';unknown+=1;all_older=False
                elif upper<=since:
                    window='before-window'
                elif lower>until:
                    window='after-window';all_older=False
                else:
                    window='boundary-review' if lower<since or upper>until else 'in-window'
                    all_older=False
                # Irrelevant rows are used for chronology only, not archived with author data.
                if row['category']=='other' and (obvious_non_pc(row['title']) or not re_pc_category(row.get('source_category',''))): continue
                if window in ('before-window','after-window'): continue
                packed=json.dumps(row,ensure_ascii=False,sort_keys=True)
                self.db.execute('INSERT INTO deals VALUES(?,?,?,?,?,?,?) ON CONFLICT(source,post_id) DO UPDATE SET category=excluded.category,candidate_key=excluded.candidate_key,payload=excluded.payload,last_seen=excluded.last_seen',(source,row['post_id'],row['category'],row['candidate_key'],packed,observed,observed))
                self.db.execute('INSERT INTO job_posts VALUES(?,?,?,?) ON CONFLICT(job_id,source,post_id) DO UPDATE SET window_status=excluded.window_status',(job_id,source,row['post_id'],window))
                fingerprint=observation_hash(row)
                self.db.execute('INSERT OR IGNORE INTO observations VALUES(?,?,?,?,?)',(source,row['post_id'],fingerprint,observed,packed))
            self.db.execute('INSERT OR REPLACE INTO pages VALUES(?,?,?,?,?,?,?,?)',(job_id,source,page,mode,signature,len(rows),unknown,observed))
            progress=self.db.execute('SELECT older_streak FROM progress WHERE job_id=? AND source=?',(job_id,source)).fetchone()
            if progress is None: raise ValueError('작업 출처가 등록되지 않았습니다.')
            streak=progress['older_streak']+1 if all_older else 0
            undated=self.db.execute("SELECT COALESCE(SUM(unknown_dates),0) FROM pages WHERE job_id=? AND source=? AND mode='live'",(job_id,source)).fetchone()[0]
            state='imported-partial' if mode=='import' else 'date-review-needed' if (streak>=2 or not has_next) and undated else 'boundary-reached' if streak>=2 else 'list-end-reached' if not has_next else 'running'
            reason='로컬 HTML 일부를 분석했습니다. 6개월 수집 완료가 아닙니다.' if mode=='import' else '공개 목록 범위에서 확인한 결과입니다. 삭제·비공개 글은 포함되지 않습니다.' if state in ('boundary-reached','list-end-reached') else '날짜를 읽지 못한 행이 있어 기간 충족을 확정하지 않습니다.' if state=='date-review-needed' else ''
            self.db.execute('UPDATE progress SET next_page=?,state=?,reason=?,older_streak=?,updated_at=? WHERE job_id=? AND source=?',(page+1 if mode=='live' else 1,state,reason,streak if mode=='live' else 0,now_iso(),job_id,source))
        return state

    def records(self,job_id):
        rows=[dict(json.loads(row['payload']),window_status=row['window_status']) for row in self.db.execute('SELECT d.payload,j.window_status FROM deals d JOIN job_posts j ON d.source=j.source AND d.post_id=j.post_id WHERE j.job_id=?',(job_id,))]
        return sorted(rows,key=lambda row:(row['posted_lower'] or '',int(row['post_id']) if row['post_id'].isdigit() else 0),reverse=True)

    def reclassify(self,job_id):
        """Update derived title/price interpretation only, retaining actual observation times."""
        rows=self.records(job_id)
        with self.db:
            for original in rows:
                row=interpret(original)
                row.pop('window_status',None)
                if row['category']=='other' and obvious_non_pc(row['title']):
                    self.db.execute('DELETE FROM job_posts WHERE job_id=? AND source=? AND post_id=?',(job_id,row['source'],row['post_id']))
                else:
                    self.db.execute('UPDATE deals SET category=?,candidate_key=?,payload=? WHERE source=? AND post_id=?',(row['category'],row['candidate_key'],json.dumps(row,ensure_ascii=False,sort_keys=True),row['source'],row['post_id']))
            observations=list(self.db.execute('SELECT o.* FROM observations o JOIN job_posts j ON o.source=j.source AND o.post_id=j.post_id WHERE j.job_id=?',(job_id,)))
            for observation in observations:
                revised=interpret(json.loads(observation['payload']))
                packed=json.dumps(revised,ensure_ascii=False,sort_keys=True);fingerprint=observation_hash(revised)
                if fingerprint==observation['fact_hash']:
                    self.db.execute('UPDATE observations SET payload=? WHERE source=? AND post_id=? AND fact_hash=?',(packed,observation['source'],observation['post_id'],fingerprint))
                else:
                    self.db.execute('INSERT INTO observations VALUES(?,?,?,?,?) ON CONFLICT(source,post_id,fact_hash) DO UPDATE SET observed_at=MIN(observations.observed_at,excluded.observed_at),payload=CASE WHEN excluded.observed_at<observations.observed_at THEN excluded.payload ELSE observations.payload END',(observation['source'],observation['post_id'],fingerprint,observation['observed_at'],packed))
                    self.db.execute('DELETE FROM observations WHERE source=? AND post_id=? AND fact_hash=?',(observation['source'],observation['post_id'],observation['fact_hash']))
        return self.summary(job_id)

    def summary(self,job_id):
        rows=self.records(job_id);progress=self.progress(job_id)
        counts={}
        for row in rows: counts[row['category']]=counts.get(row['category'],0)+1
        pages=[dict(r) for r in self.db.execute('SELECT source,mode,COUNT(*) AS pages,SUM(row_count) AS rows,SUM(unknown_dates) AS unknown_dates FROM pages WHERE job_id=? GROUP BY source,mode',(job_id,))]
        completed=bool(progress) and all(row['state'] in ('boundary-reached','list-end-reached') for row in progress)
        anchors=[dict(row) for row in self.db.execute('SELECT source,post_url,published_at,checked_at FROM date_anchors WHERE job_id=?',(job_id,))]
        return {'job':self.job(job_id),'sources':progress,'pages':pages,'stored_posts':len(rows),'classified_pc_posts':sum(n for k,n in counts.items() if k!='other'),'category_counts':counts,'year_inferred_posts':sum(row['date_precision']=='day-year-inferred' for row in rows),'date_anchors':anchors,'title_candidate_groups':len({row['candidate_key'] for row in rows if row['category']!='other'}),'all_sources_window_complete':completed,'current_prices_verified':0,'publication_authorized':False,'commercial_reuse_review':'퀘이사존 약관의 영리 목적 사용 제한 등 출처별 이용 범위를 별도 확인해야 합니다. 수집 완료는 재게시 허가를 뜻하지 않습니다.','generated_at':now_iso()}


def re_pc_category(text):
    return any(value in text.upper() for value in ['PC/하드웨어','컴퓨터','PC부품'])
