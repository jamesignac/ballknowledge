"""Allowlisted NBA adapters with persistent scoped caching and bounded concurrency."""

import hashlib
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from .database import ProviderCache
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from scripts.nba_data import TEAM_IDS

log = logging.getLogger("ballknowledge.providers")
_gate = threading.Semaphore(3)
_pace = threading.Lock()
_last_request = 0.0


def tables(response):
    result = response.get("resultSets", [])
    if isinstance(result, dict):
        result = [result]
    output = []
    for table in result:
        headers = table["headers"]
        if headers and isinstance(headers[0], dict):
            names = headers[-1]["columnNames"]
            rows = []
            zones = [
                "ra",
                "paint",
                "mid",
                "leftCorner",
                "rightCorner",
                "aboveBreak",
                "backcourt",
                "corner",
            ]
            for values in table["rowSet"]:
                row = dict(zip(names[:6], values[:6]))
                for i, zone in enumerate(zones):
                    for j, field in enumerate(["made", "attempts", "fg"]):
                        row[f"{zone}:{field}"] = values[6 + 3 * i + j]
                row["_FGA"] = sum(values[6 + 3 * i + 1] or 0 for i in range(7))
                rows.append(row)
        else:
            rows = [dict(zip(headers, row)) for row in table["rowSet"]]
        output.append({"name": table["name"], "rows": rows})
    return output


def fetch(source, scope, **options):
    from nba_api.stats.endpoints import (
        leaguedashplayerstats,
        leaguehustlestatsplayer,
        leaguedashptstats,
        leaguedashplayershotlocations,
        leaguedashptdefend,
        leaguedashplayerclutch,
        leaguedashlineups,
        teamplayeronoffsummary,
        teamplayeronoffdetails,
        leagueseasonmatchups,
        playercareerstats,
        leaguedashteamstats,
        scheduleleaguev2,
        synergyplaytypes,
    )

    team_id = next((k for k, v in TEAM_IDS.items() if v == scope.team), 0)
    common = {
        "season": scope.season,
        "season_type_all_star": scope.seasonType,
        "timeout": 12,
    }
    ranged = {
        "date_from_nullable": scope.start.strftime("%m/%d/%Y") if scope.start else "",
        "date_to_nullable": scope.end.strftime("%m/%d/%Y") if scope.end else "",
        "team_id_nullable": team_id,
        "location_nullable": {"home": "Home", "away": "Road"}.get(scope.split, ""),
        "outcome_nullable": {"wins": "W", "losses": "L"}.get(scope.split, ""),
    }
    last_n = scope.split[4:] if scope.split.startswith("last") else "0"
    if last_n != "0" and source not in ("career", "schedule"):
        return {
            "rows": [],
            "reason": "This aggregate feed cannot verify the same per-player last-N appearance sample. Choose an explicit date window or all games.",
        }
    if source == "schedule":
        schedule = scheduleleaguev2.ScheduleLeagueV2(
            season=scope.season, timeout=12
        ).get_normalized_dict()["SeasonGames"]
        rows = []
        prefix = "004" if scope.seasonType == "Playoffs" else "002"
        for game in schedule:
            if not str(game["gameId"]).startswith(prefix):
                continue
            rows.append(
                {
                    "id": str(game["gameId"]),
                    "date": game["gameDateEst"][:10],
                    "season": scope.season,
                    "home": game["homeTeam_teamTricode"],
                    "away": game["awayTeam_teamTricode"],
                    "homeScore": game.get("homeTeam_score")
                    if game["gameStatus"] != 1
                    else None,
                    "awayScore": game.get("awayTeam_score")
                    if game["gameStatus"] != 1
                    else None,
                    "status": {1: "scheduled", 2: "live", 3: "final"}.get(
                        game["gameStatus"], "unknown"
                    ),
                    "statusText": game.get("gameStatusText"),
                    "tipoff": game.get("gameDateTimeUTC"),
                    "round": game.get("gameLabel"),
                    "series": game.get("seriesText"),
                    "seriesGame": game.get("seriesGameNumber"),
                }
            )
        return {"rows": rows}
    if source in ("advanced", "scoring", "misc"):
        response = leaguedashplayerstats.LeagueDashPlayerStats(
            **common,
            **ranged,
            last_n_games=last_n,
            per_mode_detailed="Totals",
            measure_type_detailed_defense={
                "advanced": "Advanced",
                "scoring": "Scoring",
                "misc": "Misc",
            }[source],
        )
    elif source == "hustle":
        if last_n != "0":
            return {
                "rows": [],
                "reason": "Hustle source does not support last-N-game windows",
            }
        response = leaguehustlestatsplayer.LeagueHustleStatsPlayer(
            **common, **ranged, per_mode_time="Totals"
        )
    elif source == "zones":
        response = leaguedashplayershotlocations.LeagueDashPlayerShotLocations(
            **common,
            **ranged,
            last_n_games=last_n,
            per_mode_detailed="Totals",
            distance_range="By Zone",
        )
    elif source == "defend":
        response = leaguedashptdefend.LeagueDashPtDefend(
            **common, **ranged, last_n_games_nullable=last_n, per_mode_simple="Totals"
        )
    elif source == "clutch":
        response = leaguedashplayerclutch.LeagueDashPlayerClutch(
            **common,
            **ranged,
            last_n_games=last_n,
            per_mode_detailed="Totals",
            clutch_time="Last 5 Minutes",
            point_diff="5",
        )
    elif source == "lineups":
        response = leaguedashlineups.LeagueDashLineups(
            **common,
            **ranged,
            last_n_games=last_n,
            group_quantity=str(options.get("size", 5)),
            measure_type_detailed_defense="Advanced",
            per_mode_detailed="Totals",
        )
    elif source in ("onoff", "teammates"):
        if not team_id:
            return {"rows": [], "reason": "Select a team to inspect on/off samples"}
        params = {**ranged}
        params.pop("team_id_nullable")
        endpoint = (
            teamplayeronoffsummary.TeamPlayerOnOffSummary
            if source == "onoff"
            else teamplayeronoffdetails.TeamPlayerOnOffDetails
        )
        response = endpoint(
            **common,
            **params,
            team_id=team_id,
            last_n_games=last_n,
            measure_type_detailed_defense="Advanced",
            per_mode_detailed="Totals",
        )
    elif source == "matchups":
        if scope.start or scope.end or scope.split != "all":
            return {
                "rows": [],
                "reason": "NBA season matchups do not support date or split filters; choose full season",
            }
        if not team_id and not options.get("player"):
            return {
                "rows": [],
                "reason": "Select a team or player to bound the matchup sample",
            }
        response = leagueseasonmatchups.LeagueSeasonMatchups(
            season=scope.season,
            season_type_playoffs=scope.seasonType,
            per_mode_simple="Totals",
            off_team_id_nullable=team_id or None,
            off_player_id_nullable=options.get("player") or "",
            timeout=12,
        )
    elif source == "playtypes":
        if scope.start or scope.end or scope.split != "all":
            return {
                "rows": [],
                "reason": "NBA play types are season-only; choose full season. No custom-date totals are substituted.",
            }
        allowed = {
            "Isolation",
            "Transition",
            "PRBallHandler",
            "PRRollman",
            "Postup",
            "Spotup",
            "Handoff",
            "Cut",
            "OffScreen",
            "OffRebound",
            "Misc",
        }
        play_type = options.get("playType", "Isolation")
        if play_type not in allowed:
            return {"rows": [], "reason": "Unknown play type"}
        response = synergyplaytypes.SynergyPlayTypes(
            season=scope.season,
            season_type_all_star=scope.seasonType,
            player_or_team_abbreviation="P",
            play_type_nullable=play_type,
            type_grouping_nullable="offensive",
            per_mode_simple="Totals",
            timeout=12,
        )
    elif source == "career":
        response = playercareerstats.PlayerCareerStats(
            player_id=options["player"], per_mode36="Totals", timeout=12
        )
    elif source in ("teamAdvanced", "teamFourFactors"):
        response = leaguedashteamstats.LeagueDashTeamStats(
            **common,
            **ranged,
            last_n_games=last_n,
            measure_type_detailed_defense="Advanced"
            if source == "teamAdvanced"
            else "Four Factors",
            per_mode_detailed="Totals",
        )
    elif source in (
        "drives",
        "Passing",
        "Rebounding",
        "Possessions",
        "CatchShoot",
        "PullUpShot",
        "SpeedDistance",
        "PaintTouch",
        "PostTouch",
        "ElbowTouch",
        "Defense",
    ):
        response = leaguedashptstats.LeagueDashPtStats(
            **common,
            **ranged,
            last_n_games=last_n,
            player_or_team="Player",
            pt_measure_type="Drives" if source == "drives" else source,
            per_mode_simple="Totals",
        )
    else:
        return {"rows": [], "reason": "This source is not connected"}
    result = tables(response.get_dict())
    return {"rows": result[0]["rows"] if result else [], "tables": result}


class NBAProviders:
    def __init__(self, sessions):
        self.sessions = sessions
        self.locks = {}
        self.lock = threading.Lock()

    def get(self, source, scope, **options):
        global _last_request
        # Display qualification/mode never changes the provider sample.
        params = scope.model_dump(
            mode="json", exclude={"minGames", "minMinutes", "position", "mode"}
        )
        key = hashlib.sha256(
            json.dumps([source, params, options], sort_keys=True).encode()
        ).hexdigest()
        with self.lock:
            if len(self.locks) > 1024:
                self.locks = {k: v for k, v in self.locks.items() if v.locked()}
            guard = self.locks.setdefault(key, threading.Lock())
        with guard:
            with self.sessions() as session:
                cached = session.get(ProviderCache, key)
                if cached and time.time() - cached.fetched_at < (
                    30
                    if source == "schedule"
                    else 60
                    if cached.payload.get("reason")
                    else 3600
                ):
                    return {
                        **cached.payload,
                        "cache": "hit",
                        "fetchedAt": datetime.fromtimestamp(
                            cached.fetched_at, timezone.utc
                        ).isoformat(),
                    }
            if os.environ.get("NBA_NETWORK_ENABLED") == "0":
                return {
                    "rows": [],
                    "reason": "NBA network access is disabled in this environment",
                    "cache": "disabled",
                    "fetchedAt": datetime.now(timezone.utc).isoformat(),
                }
            with _gate:
                with _pace:
                    time.sleep(max(0, 0.6 - (time.monotonic() - _last_request)))
                    _last_request = time.monotonic()
                started = time.monotonic()
                try:
                    result = fetch(source, scope, **options)
                except Exception as error:
                    log.warning(
                        "nba_source_failed source=%s error_type=%s",
                        source,
                        type(error).__name__,
                    )
                    result = {
                        "rows": [],
                        "reason": "NBA source is temporarily unavailable; retry shortly",
                    }
                log.info(
                    "nba_source source=%s duration_ms=%d rows=%d",
                    source,
                    1000 * (time.monotonic() - started),
                    len(result.get("rows", [])),
                )
            fetched = time.time()
            with self.sessions.begin() as session:
                insert = (
                    sqlite_insert
                    if session.bind.dialect.name == "sqlite"
                    else postgres_insert
                )
                statement = insert(ProviderCache).values(
                    key=key, source=source, fetched_at=fetched, payload=result
                )
                session.execute(
                    statement.on_conflict_do_update(
                        index_elements=["key"],
                        set_={
                            "source": source,
                            "fetched_at": fetched,
                            "payload": result,
                        },
                    )
                )
            return {
                **result,
                "cache": "miss",
                "fetchedAt": datetime.fromtimestamp(fetched, timezone.utc).isoformat(),
            }
