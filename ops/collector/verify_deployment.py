"""Verify the committed price snapshot on production, without secrets or writes."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from build_prices import atomic_write_json, repo_root
from price_snapshot import load_price_snapshot, read_snapshot_json

KST = timezone(timedelta(hours=9))
MAX_BYTES = 64 * 1024


class DeploymentReadError(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def safe_base(raw: str) -> str:
    parsed = urlsplit(raw)
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("INVALID_DEPLOYMENT_ORIGIN")
    production = parsed.scheme == "https" and parsed.hostname == "bluedeal.co.kr" and parsed.port in (None, 443)
    local = parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1", "::1") and parsed.port is not None
    if not production and not local:
        raise ValueError("INVALID_DEPLOYMENT_ORIGIN")
    return raw.rstrip("/")


def fetch_json(url: str, timeout: float) -> dict:
    try:
        request = Request(url, headers={"User-Agent": "BLUEDEALDeploymentCheck/1.0", "Accept": "application/json", "Cache-Control": "no-cache"})
        with build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            content_type = response.headers.get_content_type()
            body = response.read(MAX_BYTES + 1)
        if content_type != "application/json" or len(body) > MAX_BYTES:
            raise DeploymentReadError("INVALID_RESPONSE")
        value = json.loads(body.decode("utf-8-sig"))
        if not isinstance(value, dict):
            raise DeploymentReadError("INVALID_RESPONSE")
        return value
    except HTTPError as error:
        raise DeploymentReadError(f"HTTP_{error.code}") from None
    except DeploymentReadError:
        raise
    except (URLError, TimeoutError, OSError, UnicodeError, ValueError):
        raise DeploymentReadError("READ_FAILED") from None


def verify_deployment(commit: str, snapshot: dict, version: str, *, base: str = "https://bluedeal.co.kr", timeout: float = 600,
                      interval: float = 5, reader: Callable = fetch_json, clock: Callable = time.monotonic, sleep: Callable = time.sleep) -> dict:
    if not re.fullmatch(r"[a-f0-9]{40}", commit) or not re.fullmatch(r"[a-f0-9]{64}", snapshot["snapshotHash"]):
        raise ValueError("INVALID_EXPECTED_DEPLOYMENT")
    if not 0 < timeout <= 600 or not 0 < interval <= 30:
        raise ValueError("INVALID_VERIFICATION_TIMING")
    base = safe_base(base)
    report = {"startedAt": datetime.now(KST).isoformat(timespec="seconds"), "status": "timeout", "attempts": 0,
              "expectedCommit": commit, "expectedVersion": version, "expectedSnapshotHash": snapshot["snapshotHash"],
              "observedCommit": None, "observedSnapshotHash": None, "itemCount": snapshot["itemCount"], "reasonCode": "NOT_DEPLOYED_YET"}
    deadline = clock() + timeout
    while clock() < deadline:
        report["attempts"] += 1
        try:
            release = reader(base + "/api/version", min(10, max(0.01, deadline - clock())))
            observed = release.get("commit")
            report["observedCommit"] = observed if isinstance(observed, str) and re.fullmatch(r"[a-f0-9]{40}", observed) else None
            if release.get("service") != "BLUEDEAL":
                report.update(status="failed", reasonCode="UNEXPECTED_SERVICE")
                break
            if observed == commit:
                if release.get("version") != version:
                    report.update(status="failed", reasonCode="VERSION_MISMATCH")
                    break
                live = reader(base + "/api/prices/status", min(10, max(0.01, deadline - clock())))
                live_hash = live.get("snapshotHash")
                report["observedSnapshotHash"] = live_hash if isinstance(live_hash, str) and re.fullmatch(r"[a-f0-9]{64}", live_hash) else None
                # Different requests may reach old/new deployments during alias rollout.
                # The fingerprint response must identify the same commit itself.
                if live.get("commit") == commit:
                    if live.get("service") != "BLUEDEAL" or live.get("schemaVersion") != 1 or live.get("version") != version:
                        report.update(status="failed", reasonCode="INVALID_SNAPSHOT_RESPONSE")
                        break
                    comparable = ("snapshotHash", "itemCount", "updatedAt", "generatedAt", "schedule", "categories")
                    if all(live.get(key) == snapshot.get(key) for key in comparable):
                        report.update(status="verified", reasonCode="MATCHED")
                        break
                    report.update(reasonCode="PRICE_SNAPSHOT_MISMATCH")
                else:
                    report.update(reasonCode="DEPLOYMENT_ROLLOUT_PENDING")
            else:
                report.update(reasonCode="NOT_DEPLOYED_YET")
        except DeploymentReadError as error:
            code = str(error)
            if code in ("HTTP_401", "HTTP_403"):
                report.update(status="blocked", reasonCode="DEPLOYMENT_PROTECTED")
                break
            report.update(reasonCode=code if re.fullmatch(r"[A-Z0-9_]+", code) else "READ_FAILED")
        remaining = deadline - clock()
        if remaining <= 0:
            break
        sleep(min(interval, remaining))
    report["completedAt"] = datetime.now(KST).isoformat(timespec="seconds")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="운영 커밋·공개 가격 스냅샷 일치 검증")
    parser.add_argument("--commit", required=True, help="배포한 40자리 Git 커밋")
    parser.add_argument("--root", default=str(repo_root()))
    parser.add_argument("--base", default="https://bluedeal.co.kr")
    parser.add_argument("--timeout", type=float, default=600)
    parser.add_argument("--interval", type=float, default=5)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    report_path = root / "ops/collector/state/last-deployment-check.json"
    try:
        # Read the exact committed blobs, not an editor's newer working copy.
        snapshot = load_price_snapshot(root, args.commit)
        version = read_snapshot_json(root, "package.json", args.commit)["version"]
        report = verify_deployment(args.commit, snapshot, version, base=args.base, timeout=args.timeout, interval=args.interval)
        atomic_write_json(report_path, report)
        if report["status"] == "verified":
            print(f"[OK] 운영 커밋과 가격 스냅샷 일치: {report['itemCount']}개 상품")
            return 0
        print(f"[ERROR] 운영 반영 확인 미완료: {report['reasonCode']}. 업로드된 커밋을 다시 게시하거나 자동 되돌리지 않습니다.")
        return 2 if report["status"] == "timeout" else 1
    except (OSError, ValueError, KeyError, TypeError, OverflowError, subprocess.TimeoutExpired):
        try:
            atomic_write_json(report_path, {"completedAt": datetime.now(KST).isoformat(timespec="seconds"), "status": "failed", "reasonCode": "COMMITTED_SNAPSHOT_UNAVAILABLE", "expectedCommit": args.commit if re.fullmatch(r"[a-f0-9]{40}", args.commit) else None})
        except OSError:
            pass
        print("[ERROR] 배포 확인 설정 또는 커밋 원본을 확인하세요. 계정·피드 값은 출력하지 않습니다.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
