"""Daily refresh with durable run status; failed validation preserves good facts."""

import argparse
import json
import logging
import signal
import subprocess
import sys
import threading
import time
import uuid
from services.api.app.database import ROOT, RefreshRun, connect
from services.api.app.import_data import import_snapshots
from services.api.app.migrate import migrate

log = logging.getLogger("ballknowledge.refresh")


def refresh(season, sessions):
    run_id = str(uuid.uuid4())
    with sessions.begin() as session:
        session.add(
            RefreshRun(
                id=run_id,
                started_at=time.time(),
                season=season,
                status="running",
                details={},
            )
        )
    status = "failed"
    details = {}
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/nba_data.py"),
                "--seasons",
                season,
                "--refresh",
            ],
            cwd=ROOT,
            timeout=900,
            check=False,
        )
        if result.returncode:
            raise RuntimeError(
                "Source refresh or validation failed; previous snapshot retained"
            )
        imported = import_snapshots(sessions)
        status = "complete"
        details = {"imported": imported}
    except Exception as error:
        details = {"errorType": type(error).__name__, "message": str(error)[:300]}
        log.exception("refresh_failed season=%s run=%s", season, run_id)
    finally:
        with sessions.begin() as session:
            run = session.get(RefreshRun, run_id)
            run.status = status
            run.finished_at = time.time()
            run.details = details
    print(
        json.dumps({"run": run_id, "season": season, "status": status, **details}),
        flush=True,
    )
    return status == "complete"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", default=None)
    parser.add_argument("--interval-seconds", type=int, default=0)
    args = parser.parse_args()
    if args.interval_seconds and args.interval_seconds < 3600:
        parser.error("Refresh interval must be at least one hour")
    engine, sessions = connect()
    migrate(engine)
    season = (
        args.season
        or json.loads((ROOT / "public/data/manifest.json").read_text(encoding="utf-8"))[
            "defaultSeason"
        ]
    )
    stop = threading.Event()
    for event in (signal.SIGINT, signal.SIGTERM):
        signal.signal(event, lambda *_: stop.set())
    while not stop.is_set():
        ok = refresh(season, sessions)
        if not args.interval_seconds:
            raise SystemExit(0 if ok else 1)
        stop.wait(args.interval_seconds)


if __name__ == "__main__":
    main()
