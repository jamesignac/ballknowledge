"""Public read API. NBA I/O is cached, allowlisted, timed and sample-checked."""

import csv
import asyncio
import io
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from functools import lru_cache
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import Response, FileResponse
from sqlalchemy import select, text
from .analytics import aggregate, on_off_rows, normalize_search
from .contracts import CATALOG, METRICS, HistoryQuery, Scope, StatsQuery
from .database import Appearance, Game, ROOT, Season, RefreshRun, connect
from .import_data import import_snapshots
from .providers import NBAProviders
from .limits import BodyLimitMiddleware

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
log = logging.getLogger("ballknowledge.api")


def create_app(database_url=None, initialize=True):
    engine, sessions = connect(database_url)
    providers = NBAProviders(sessions)

    @asynccontextmanager
    async def lifespan(app):
        if initialize:
            # Migration entrypoint is also usable independently before replicas start.
            from .migrate import migrate

            migrate(engine)
            import_snapshots(sessions)
            if (ROOT / "public/data/playoffs/manifest.json").exists():
                import_snapshots(sessions, ROOT / "public/data/playoffs")
        yield
        engine.dispose()

    app = FastAPI(
        title="Ballknowledge analytics",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.sessions = sessions
    app.state.providers = providers
    app.add_middleware(BodyLimitMiddleware)
    analysis_slots = asyncio.Semaphore(8)

    @app.middleware("http")
    async def timing(request: Request, call_next):
        started = time.monotonic()
        limited = request.method == "POST"
        if limited:
            try:
                await asyncio.wait_for(analysis_slots.acquire(), timeout=0.25)
            except TimeoutError:
                return Response(
                    "Analytics is busy; retry shortly",
                    status_code=503,
                    headers={"Retry-After": "2"},
                )
        try:
            response = await call_next(request)
        finally:
            if limited:
                analysis_slots.release()
        response.headers["Server-Timing"] = (
            f"app;dur={1000 * (time.monotonic() - started):.1f}"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        log.info(
            "request method=%s path=%s status=%d duration_ms=%d",
            request.method,
            request.url.path,
            response.status_code,
            1000 * (time.monotonic() - started),
        )
        return response

    @lru_cache(maxsize=6)
    def load(season_id, fingerprint):
        with sessions() as session:
            season = session.get(Season, season_id)
            logs = list(
                session.scalars(
                    select(Appearance.payload).where(Appearance.season == season_id)
                )
            )
            games = list(
                session.scalars(select(Game.payload).where(Game.season == season_id))
            )
            return (
                season.metadata_json,
                {p["id"]: p for p in season.roster_json},
                logs,
                {g["id"]: g for g in games},
            )

    def dataset(scope):
        season_key = scope.season + (
            ":playoffs" if scope.seasonType == "Playoffs" else ""
        )
        with sessions() as session:
            season = session.get(Season, season_key)
            if not season:
                raise HTTPException(404, detail="Season has not been imported")
            return load(season.id, season.fingerprint)

    def meta(scope, metadata, sources=None):
        return {
            "scope": scope.model_dump(mode="json"),
            "dataAsOf": metadata["source"]["fetchedAt"],
            "source": metadata["source"],
            "formulaVersion": CATALOG["formulaVersion"],
            "cohort": "All players meeting date, team, position, split and qualification filters; before search and metric filters. Ties use midrank; lower-is-better metrics are reversed.",
            "providers": {
                k: {a: b for a, b in v.items() if a not in ("rows", "tables")}
                for k, v in (sources or {}).items()
            },
        }

    def statistics(query, export_all=False):
        metadata, players, logs, games = dataset(query.scope)
        requested = list(
            dict.fromkeys(
                [*query.metrics, query.sort, *(f.metric for f in query.filters)]
            )
        )
        sources = {METRICS[key]["source"] for key in requested} - {
            "box",
            "derived",
            "unavailable",
        }
        if query.scope.mode in ("per75", "per100"):
            sources.add("advanced")
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = {
                source: pool.submit(providers.get, source, query.scope)
                for source in sources
            }
            observed = {source: future.result() for source, future in futures.items()}
        rows = aggregate(logs, players, games, query.scope, requested, observed)
        cohort = len(rows)
        if query.search:
            rows = [
                row
                for row in rows
                if normalize_search(query.search)
                in normalize_search(row["player"]["name"])
            ]
        for condition in query.filters:
            rows = [
                row
                for row in rows
                if row["values"][condition.metric] is not None
                and (
                    row["values"][condition.metric] >= condition.value
                    if condition.op == "gte"
                    else row["values"][condition.metric] <= condition.value
                )
            ]
        # Null values always sort last, including ascending order.
        rows.sort(
            key=lambda row: (
                row["values"][query.sort] is None,
                (row["values"][query.sort] or 0) * (1 if query.ascending else -1),
                row["player"]["name"],
            )
        )
        result = {
            "rows": rows
            if export_all
            else rows[query.offset : query.offset + query.limit],
            "total": len(rows),
            "cohortSize": cohort,
            "definitions": {key: METRICS[key] for key in requested},
            "meta": meta(query.scope, metadata, observed),
        }
        return result

    @app.get("/api/health")
    def health():
        with sessions() as session:
            session.execute(text("SELECT 1"))
            seasons = list(session.scalars(select(Season.id)))
            latest = session.scalar(
                select(RefreshRun).order_by(RefreshRun.started_at.desc()).limit(1)
            )
            refresh = (
                {
                    "status": latest.status,
                    "startedAt": latest.started_at,
                    "finishedAt": latest.finished_at,
                    "season": latest.season,
                }
                if latest
                else None
            )
        return {
            "status": "ok" if seasons else "empty",
            "seasons": seasons,
            "database": engine.dialect.name,
            "lastRefresh": refresh,
        }

    @app.get("/api/metrics")
    def metrics():
        return CATALOG

    @app.get("/api/snapshots/manifest.json")
    def snapshot_manifest():
        with sessions() as session:
            records = list(
                session.scalars(
                    select(Season)
                    .where(~Season.id.contains(":"))
                    .order_by(Season.id.desc())
                )
            )
        return {
            "schemaVersion": 1,
            "defaultSeason": records[0].id if records else None,
            "seasons": [record.metadata_json for record in records],
        }

    @app.get("/api/snapshots/{filename}")
    def snapshot_file(filename: str):
        if not re.fullmatch(r"20\d{2}-\d{2}-[0-9a-f]{12}\.json", filename):
            raise HTTPException(404, "Unknown snapshot")
        path = ROOT / "public/data" / filename
        if not path.is_file():
            raise HTTPException(404, "Snapshot is no longer present")
        return FileResponse(
            path,
            media_type="application/json",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )

    @app.get("/api/seasons")
    def seasons():
        with sessions() as session:
            rows = list(session.scalars(select(Season).order_by(Season.id.desc())))
            return {
                "seasons": [row.metadata_json for row in rows],
                "seasonTypes": sorted(
                    {
                        row.metadata_json.get("seasonType", "Regular Season")
                        for row in rows
                    }
                ),
            }

    @app.post("/api/stats")
    def stats(query: StatsQuery):
        return statistics(query)

    @app.post("/api/history")
    def history(query: HistoryQuery):
        if any(
            METRICS[key]["source"] not in ("box", "derived")
            for key in [*query.metrics, query.sort]
        ):
            raise HTTPException(
                422,
                "History supports additive box-score components and their documented derived ratios. Provider ratings are not pooled.",
            )
        if query.scope.mode in ("per75", "per100"):
            raise HTTPException(
                422,
                "Historical possession normalization requires validated possession facts for every selected season. Choose per game, per 36 or totals.",
            )
        scopes = [
            query.scope.model_copy(
                update={"season": season, "start": None, "end": None}
            )
            for season in sorted(dict.fromkeys(query.seasons))
        ]
        datasets = [dataset(scope) for scope in scopes]
        requested = list(
            dict.fromkeys(
                [*query.metrics, query.sort, *(item.metric for item in query.filters)]
            )
        )
        if any(METRICS[key]["source"] not in ("box", "derived") for key in requested):
            raise HTTPException(
                422, "Historical metric filters must use box-score or derived metrics"
            )
        if query.pooled:
            all_players = {}
            all_logs = []
            all_games = {}
            for _, players, logs, games in datasets:
                all_players.update(players)
                all_logs.extend(logs)
                all_games.update(games)
            rows = aggregate(all_logs, all_players, all_games, scopes[0], requested, {})
            for row in rows:
                row["season"] = "Pooled"
                row["rowId"] = f"pooled:{row['player']['id']}"
        else:
            rows = []
            for scope, (_, players, logs, games) in zip(scopes, datasets):
                season_rows = aggregate(logs, players, games, scope, requested, {})
                for row in season_rows:
                    row["season"] = scope.season
                    row["rowId"] = f"{scope.season}:{row['player']['id']}"
                rows.extend(season_rows)
        cohort = len(rows)
        rows = [
            row
            for row in rows
            if normalize_search(query.search) in normalize_search(row["player"]["name"])
        ]
        for item in query.filters:
            rows = [
                row
                for row in rows
                if row["values"][item.metric] is not None
                and (
                    row["values"][item.metric] >= item.value
                    if item.op == "gte"
                    else row["values"][item.metric] <= item.value
                )
            ]
        rows.sort(
            key=lambda row: (
                row["values"][query.sort] is None,
                (row["values"][query.sort] or 0) * (1 if query.ascending else -1),
            )
        )
        metadata = meta(query.scope, datasets[-1][0])
        metadata.update(
            {
                "seasons": query.seasons,
                "pooled": query.pooled,
                "coverage": [data[0] for data in datasets],
                "cohort": "Pooled player cohort"
                if query.pooled
                else "Percentiles computed separately within each season’s eligible player cohort",
                "window": "Full imported seasons; custom date controls are intentionally replaced.",
            }
        )
        return {
            "rows": rows[query.offset : query.offset + query.limit],
            "total": len(rows),
            "cohortSize": cohort,
            "definitions": {key: METRICS[key] for key in requested},
            "meta": metadata,
        }

    @app.post("/api/export")
    def export(query: StatsQuery):
        # Export matches the entire filtered population; the interactive page limit
        # must never silently truncate a downloaded dataset.
        query = query.model_copy(update={"offset": 0, "limit": 500})
        result = statistics(query, export_all=True)
        stream = io.StringIO(newline="")
        writer = csv.writer(stream)
        writer.writerow(["# scope", str(result["meta"]["scope"])])
        writer.writerow(
            [
                "# source",
                result["meta"]["source"]["label"],
                "data_as_of",
                result["meta"]["dataAsOf"],
            ]
        )
        for source, provider in result["meta"]["providers"].items():
            writer.writerow(
                [
                    "# provider",
                    source,
                    "fetched_at",
                    provider.get("fetchedAt"),
                    "availability",
                    provider.get("reason", "available"),
                ]
            )
        writer.writerow(["# rows", len(result["rows"]), "matching", result["total"]])
        for key in query.metrics:
            writer.writerow(["# definition", key, METRICS[key]["definition"]])
        writer.writerow(
            ["player_id", "player", "team", "games", "minutes", *query.metrics]
        )
        for row in result["rows"]:

            def safe(value):
                if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
                    return "'" + value
                return value

            writer.writerow(
                [
                    row["player"]["id"],
                    safe(row["player"]["name"]),
                    row["player"]["team"],
                    row["games"],
                    row["minutes"],
                    *[
                        row["values"].get(key)
                        if row["values"].get(key) is not None
                        else f"Unavailable: {row['missing'].get(key, 'no sample')}"
                        for key in query.metrics
                    ],
                ]
            )
        return Response(
            stream.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": 'attachment; filename="ballknowledge-stats.csv"'
            },
        )

    @app.post("/api/games")
    def games(scope: Scope):
        metadata, _, _, games = dataset(scope)
        rows = [
            game
            for game in games.values()
            if (not scope.start or game["date"] >= scope.start.isoformat())
            and (not scope.end or game["date"] <= scope.end.isoformat())
            and (not scope.team or scope.team in (game["home"], game["away"]))
        ]
        return {
            "games": sorted(rows, key=lambda g: (g["date"], g["id"])),
            "meta": meta(scope, metadata),
        }

    @app.post("/api/schedule")
    def schedule(scope: Scope):
        metadata, _, _, games = dataset(scope)
        result = providers.get("schedule", scope)
        # Offline fallback remains explicit: these are imported completed games,
        # not an invented future schedule or stale "live" score.
        rows = (
            result["rows"]
            if not result.get("reason")
            else [
                {**g, "status": "final", "statusText": "Imported final"}
                for g in games.values()
            ]
        )
        return {
            "games": [
                g
                for g in rows
                if not scope.team or scope.team in (g["home"], g["away"])
            ],
            "reason": result.get("reason"),
            "fetchedAt": result.get("fetchedAt"),
            "meta": meta(scope, metadata, {"schedule": result}),
        }

    @app.get("/api/games/{game_id}")
    def box(game_id: str):
        if len(game_id) != 10 or not game_id.isdigit():
            raise HTTPException(422, "Invalid game ID")
        with sessions() as session:
            game = session.get(Game, game_id)
            if not game:
                raise HTTPException(404, "Game has not been imported")
            game_scope = Scope(
                season=game.season.split(":")[0],
                seasonType="Playoffs"
                if ":playoffs" in game.season
                else "Regular Season",
            )
            metadata, players, _, _ = dataset(game_scope)
            logs = list(
                session.scalars(
                    select(Appearance.payload).where(Appearance.game_id == game_id)
                )
            )
        return {
            "game": game.payload,
            "players": [
                {**row, "name": players[row["playerId"]]["name"]} for row in logs
            ],
            "meta": meta(game_scope, metadata),
        }

    @app.post("/api/players/{player_id}")
    def player_dashboard(player_id: int, scope: Scope):
        metadata, players, logs, games = dataset(scope)
        if player_id not in players:
            raise HTTPException(
                404, "Player has no recorded appearances in this season"
            )
        summary = statistics(
            StatsQuery(
                scope=scope,
                metrics=list(
                    dict.fromkeys(
                        [
                            "gp",
                            "min",
                            "reb",
                            "ast",
                            "stl",
                            "blk",
                            "tov",
                            *CATALOG["presets"]["Shooting"],
                        ]
                    )
                ),
                search=players[player_id]["name"],
                limit=10,
            )
        )
        row = next((r for r in summary["rows"] if r["player"]["id"] == player_id), None)
        log_rows = [
            g
            for g in logs
            if g["playerId"] == player_id
            and (not scope.start or g["date"] >= scope.start.isoformat())
            and (not scope.end or g["date"] <= scope.end.isoformat())
            and (not scope.team or g["team"] == scope.team)
        ]
        if scope.split in ("home", "away"):
            log_rows = [g for g in log_rows if g["home"] == (scope.split == "home")]
        if scope.split in ("wins", "losses"):
            log_rows = [
                g
                for g in log_rows
                if (
                    (games[g["gameId"]]["homeScore"] > games[g["gameId"]]["awayScore"])
                    == g["home"]
                )
                == (scope.split == "wins")
            ]
        if scope.split.startswith("last"):
            log_rows = sorted(log_rows, key=lambda g: (g["date"], g["gameId"]))[
                -int(scope.split[4:]) :
            ]
        splits = {}
        for split in (
            "all",
            "last5",
            "last10",
            "last20",
            "home",
            "away",
            "wins",
            "losses",
        ):
            values = aggregate(
                logs,
                players,
                games,
                scope.model_copy(update={"split": split}),
                ["gp", "min", "pts", "reb", "ast", "ts", "efg"],
                {},
            )
            splits[split] = next(
                (r for r in values if r["player"]["id"] == player_id), None
            )
        return {
            "player": players[player_id],
            "summary": row,
            "logs": sorted(log_rows, key=lambda g: g["date"], reverse=True),
            "splits": splits,
            "meta": meta(scope, metadata),
        }

    @app.post("/api/explore/{feature}")
    def explore(
        feature: str,
        scope: Scope,
        size: int = Query(5, ge=2, le=5),
        player: int = Query(0, ge=0),
        playType: str = Query("Isolation", max_length=30),
        search: str = Query("", max_length=100),
        offset: int = Query(0, ge=0, le=200000),
        limit: int = Query(200, ge=1, le=2000),
        sort: str = Query("MIN", max_length=50),
        minMins: float = Query(0, ge=0, le=6000),
        minPoss: float = Query(0, ge=0, le=100000),
    ):
        if feature not in (
            "lineups",
            "onoff",
            "teammates",
            "matchups",
            "career",
            "teamAdvanced",
            "teamFourFactors",
            "zones",
            "playtypes",
        ):
            raise HTTPException(404, "Unknown analysis feature")
        metadata, player_records, appearance_records, game_records = dataset(scope)
        if feature == "career" and player <= 0:
            raise HTTPException(422, "Select a player")
        result = providers.get(
            "lineups" if feature == "teammates" else feature,
            scope,
            size=2 if feature == "teammates" else size,
            player=player,
            playType=playType,
        )
        if feature == "onoff":
            result = {**result, "rows": on_off_rows(result.get("tables", []))}
        if feature == "zones":
            qualified = aggregate(
                appearance_records,
                player_records,
                game_records,
                scope.model_copy(update={"mode": "totals"}),
                ["fga"],
                {},
            )
            qualified_by_id = {row["player"]["id"]: row for row in qualified}
            matched = []
            for source_row in result.get("rows", []):
                observed = qualified_by_id.get(source_row.get("PLAYER_ID"))
                if observed and source_row.get("_FGA") == observed["values"]["fga"]:
                    matched.append(
                        {**source_row, "TEAM_ABBREVIATION": observed["player"]["team"]}
                    )
            result = {**result, "rows": matched}
        if feature == "playtypes" and scope.team:
            result = {
                **result,
                "rows": [
                    row
                    for row in result["rows"]
                    if row.get("TEAM_ABBREVIATION") == scope.team
                ],
            }
        observations = [
            row
            for row in result.get("rows", [])
            if (
                not search
                or any(
                    search.casefold() in str(value).casefold() for value in row.values()
                )
            )
            and float(row.get("MIN", float(row.get("MATCHUP_TIME_SEC", 0)) / 60) or 0)
            >= minMins
            and float(row.get("POSS", row.get("PARTIAL_POSS", 0)) or 0) >= minPoss
            and float(row.get("GP", scope.minGames) or 0) >= scope.minGames
        ]
        if minMins == 0 and minPoss == 0 and feature == "zones":
            observations = [
                row
                for row in result.get("rows", [])
                if not search
                or any(
                    search.casefold() in str(value).casefold() for value in row.values()
                )
            ]
        observations.sort(
            key=lambda row: (
                row.get(sort) is None,
                -float(row[sort])
                if isinstance(row.get(sort), (float, int))
                else str(row.get(sort, "")),
            )
        )
        result = {
            **result,
            "total": len(observations),
            "rows": observations[offset : offset + limit],
            "tables": [
                {**table, "rows": table["rows"][:2000]}
                for table in result.get("tables", [])
            ],
        }
        return {
            **result,
            "meta": meta(scope, metadata, {feature: result}),
            "unavailableMetrics": [
                "Individual with/without-teammate box scores require validated substitution stints. This view shows NBA two-player shared-floor ratings."
            ]
            if feature == "teammates"
            else [],
            "interpretation": "On/off, lineup and matchup observations describe association and role. They do not isolate a player’s causal impact.",
        }

    return app


app = create_app()
