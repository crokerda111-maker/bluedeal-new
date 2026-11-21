#!/usr/bin/env python3
"""Loopback-only controls for the local collector. No credentials are read."""
from __future__ import annotations

import argparse
import hmac
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import json
import secrets
import threading
from urllib.parse import parse_qs,urlsplit
import webbrowser

from crawler import CrawlLock,crawl
from report import export,render
from research import ensure_job
from store import DEFAULT_DATA,Store,data_directory


class Application:
    def __init__(self,directory):
        self.directory=data_directory(directory);self.lock=threading.Lock();self.worker=None;self.stop=threading.Event();self.message='';self.csrf=secrets.token_urlsafe(32)
        store=Store(directory)
        try:
            job=ensure_job(store);export(store,job['id'])
        finally: store.close()

    def running(self): return self.worker is not None and self.worker.is_alive()

    def external_running(self):
        if self.running(): return False
        try:
            with CrawlLock(self.directory): return False
        except ValueError: return True

    def start(self):
        with self.lock:
            if self.running(): return
            if self.external_running():
                self.message='다른 명령창에서 수집 중입니다. 그 창의 Ctrl+C로 중지할 수 있습니다.';return
            self.stop.clear();self.message='수집을 시작했습니다. 제한된 출처는 사유를 기록하고 다음 출처로 진행합니다.'
            self.worker=threading.Thread(target=self.run,daemon=True);self.worker.start()

    def run(self):
        store=Store(self.directory)
        try:
            job=ensure_job(store);crawl(store,job['id'],stop=self.stop)
            self.message='이번 실행을 마쳤습니다. 출처별 상태와 실제 수집 범위를 확인하세요.'
        except Exception:
            self.message='실행을 중지했습니다. 저장된 진행 상태를 보존했습니다.'
        finally:
            try:
                if store.latest_job(): export(store,store.latest_job()['id'])
            finally: store.close()


def create_server(directory=DEFAULT_DATA,port=24898):
    app=Application(directory);origin=f'http://127.0.0.1:{port}'
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def send(self,code,data=b'',kind='text/html; charset=utf-8',headers=None):
            self.send_response(code)
            for k,v in {'Content-Type':kind,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",**(headers or {})}.items(): self.send_header(k,v)
            self.end_headers();self.wfile.write(data)
        def valid_host(self): return self.headers.get('Host')==f'127.0.0.1:{port}'
        def do_GET(self):
            if not self.valid_host(): self.send(403);return
            url=urlsplit(self.path)
            if url.path=='/health':
                self.send(200,json.dumps({'service':'BLUEDEAL-HOTDEAL-RESEARCH','version':1}).encode(),'application/json; charset=utf-8')
            elif url.path=='/':
                query=parse_qs(url.query);store=Store(app.directory)
                try:
                    job=store.latest_job();summary=store.summary(job['id']);rows=store.records(job['id'])
                    try: page=int(query.get('page',['1'])[0])
                    except ValueError: page=1
                    external=app.external_running()
                    body=render(summary,rows,q=query.get('q',[''])[0],category=query.get('category',[''])[0],page=page,csrf=app.csrf,running=app.running() or external,can_stop=app.running(),message='명령창에서 수집 중입니다. 진행 상태가 자동 갱신되며 해당 명령창의 Ctrl+C로 중지할 수 있습니다.' if external else app.message)
                    self.send(200,body.encode())
                finally: store.close()
            elif url.path.startswith('/exports/') and url.path.split('/')[-1] in ('deals.csv','verification-queue.csv','summary.json') and url.path.count('/')==2:
                store=Store(app.directory)
                try: export(store,store.latest_job()['id'])
                finally: store.close()
                name=url.path.split('/')[-1];file=app.directory/'exports'/name
                self.send(200,file.read_bytes(),'text/csv; charset=utf-8' if name.endswith('.csv') else 'application/json; charset=utf-8',{'Content-Disposition':f'attachment; filename="{name}"'})
            else: self.send(404)
        def do_POST(self):
            if not self.valid_host() or self.headers.get('Origin')!=origin: self.send(403);return
            try: length=int(self.headers.get('Content-Length','0'))
            except ValueError: self.send(400);return
            if not 0<length<=4096 or self.headers.get_content_type()!='application/x-www-form-urlencoded': self.send(400);return
            body=parse_qs(self.rfile.read(length).decode('utf-8','replace'))
            if not hmac.compare_digest(body.get('csrf',[''])[0],app.csrf): self.send(403);return
            if self.path=='/start': app.start()
            elif self.path=='/stop': app.stop.set();app.message='중지 요청을 보냈습니다. 현재 응답 처리가 끝나면 진행 상태를 저장합니다.'
            else: self.send(404);return
            self.send(303,headers={'Location':'/'})
    server=ThreadingHTTPServer(('127.0.0.1',port),Handler)
    port=server.server_port;origin=f'http://127.0.0.1:{port}'
    return server,app


def serve(directory=DEFAULT_DATA,port=24898,open_browser=False):
    origin=f'http://127.0.0.1:{port}'
    try: server,app=create_server(directory,port)
    except OSError:
        if open_browser:
            import urllib.request
            try:
                with urllib.request.urlopen(origin+'/health',timeout=2) as response: health=json.load(response)
                if health.get('service')=='BLUEDEAL-HOTDEAL-RESEARCH':
                    webbrowser.open(origin+'/');print('기존 수집기 화면을 열었습니다.');return
            except (OSError,ValueError): pass
        raise
    print(f'BLUEDEAL_LOCAL_COLLECTOR={origin}/',flush=True)
    if open_browser: webbrowser.open(origin+'/')
    try: server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt: pass
    finally:
        app.stop.set()
        if app.running(): app.worker.join(timeout=30)
        server.server_close()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data-dir',default=str(DEFAULT_DATA));parser.add_argument('--port',type=int,default=24898);parser.add_argument('--open-browser',action=argparse.BooleanOptionalAction,default=False);args=parser.parse_args()
    serve(args.data_dir,args.port,args.open_browser)
