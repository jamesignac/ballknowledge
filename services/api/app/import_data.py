"""Transactional import. Validation completes before a previous season is replaced."""

import hashlib
import json
from sqlalchemy import delete, insert
from scripts.nba_data import validate_snapshot
from .database import Appearance, Game, Player, ROOT, Season


def import_snapshots(sessions, directory=None):
    directory = directory or ROOT / "public/data"
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    imported = []
    for entry in reversed(manifest["seasons"]):
        season_key = entry["id"] + (
            ":playoffs" if entry.get("seasonType") == "Playoffs" else ""
        )
        path = directory / PathName(entry["path"])
        content = path.read_bytes()
        fingerprint = hashlib.sha256(content).hexdigest()
        with sessions() as session:
            existing = session.get(Season, season_key)
            if (
                existing
                and existing.fingerprint == fingerprint
                and existing.metadata_json.get("path") == entry["path"]
            ):
                continue
        snapshot = json.loads(content)
        if snapshot["metadata"]["id"] != entry["id"] or any(
            log["season"] != entry["id"] for log in snapshot["gameLogs"]
        ):
            raise ValueError("Snapshot season does not match its manifest entry")
        validate_snapshot(snapshot)
        with sessions.begin() as session:
            session.execute(delete(Appearance).where(Appearance.season == season_key))
            session.execute(delete(Game).where(Game.season == season_key))
            session.merge(
                Season(
                    id=season_key,
                    metadata_json={**snapshot["metadata"], "path": entry["path"]},
                    roster_json=snapshot["players"],
                    fingerprint=fingerprint,
                )
            )
            for player in snapshot["players"]:
                session.merge(Player(id=player["id"], profile=player))
            session.flush()
            session.execute(
                insert(Game),
                [
                    {
                        "id": g["id"],
                        "season": season_key,
                        "date": g["date"],
                        "payload": g,
                    }
                    for g in snapshot["games"]
                ],
            )
            records = []
            for log in snapshot["gameLogs"]:
                records.append(
                    {
                        "game_id": log["gameId"],
                        "player_id": log["playerId"],
                        "season": season_key,
                        "date": log["date"],
                        "team": log["team"],
                        "minutes": log["min"],
                        "payload": log,
                    }
                )
            session.execute(insert(Appearance), records)
        imported.append(season_key)
    return imported


def PathName(path):
    """Only allow committed snapshot basenames from the local manifest."""
    from pathlib import PurePosixPath

    return PurePosixPath(path).name
