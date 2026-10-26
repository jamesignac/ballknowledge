"""Pure aggregation: summed denominators, explicit missingness and stable cohorts."""

import math
import unicodedata
from collections import defaultdict
from .contracts import METRICS


def ratio(a, b, scale=100):
    return scale * a / b if b else None


def normalize_search(value):
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if not unicodedata.combining(character)
    )


def on_off_rows(source_tables):
    on = next(
        (
            table["rows"]
            for table in source_tables
            if table["name"].startswith("PlayersOnCourt")
        ),
        [],
    )
    off = next(
        (
            table["rows"]
            for table in source_tables
            if table["name"].startswith("PlayersOffCourt")
        ),
        [],
    )
    index = {row["VS_PLAYER_ID"]: row for row in off}
    output = []
    for row in on:
        without = index.get(row["VS_PLAYER_ID"], {})
        off_net = without.get("NET_RATING") if without.get("MIN", 0) > 0 else None
        on_net = row.get("NET_RATING") if row.get("MIN", 0) > 0 else None
        output.append(
            {
                **row,
                "OFF_MIN": without.get("MIN"),
                "OFF_NET_RATING": off_net,
                "ON_OFF_NET": on_net - off_net
                if on_net is not None and off_net is not None
                else None,
            }
        )
    return output


def percentile_values(values, higher=True):
    valid = sorted(v for v in values if v is not None and math.isfinite(v))
    if len(valid) < 2:
        return [50 if v is not None else None for v in values]
    from bisect import bisect_left, bisect_right

    result = []
    for value in values:
        if value is None:
            result.append(None)
            continue
        rank = (
            100
            * (bisect_left(valid, value) + bisect_right(valid, value) - 1)
            / (2 * (len(valid) - 1))
        )
        result.append(rank if higher else 100 - rank)
    return result


def aggregate(logs, players, games, scope, metric_ids, providers):
    window = [
        g
        for g in logs
        if (not scope.start or g["date"] >= scope.start.isoformat())
        and (not scope.end or g["date"] <= scope.end.isoformat())
    ]
    league = {k: sum(g[k] for g in window) for k in ("pts", "fga", "fta")}
    league_ts = ratio(league["pts"], 2 * (league["fga"] + 0.44 * league["fta"]))
    grouped = defaultdict(list)
    for log in window:
        if scope.team and log["team"] != scope.team:
            continue
        if scope.split in ("home", "away") and log["home"] != (scope.split == "home"):
            continue
        game = games.get(log["gameId"])
        if scope.split in ("wins", "losses"):
            if not game:
                continue
            won = (game["homeScore"] > game["awayScore"]) == log["home"]
            if won != (scope.split == "wins"):
                continue
        grouped[log["playerId"]].append(log)
    indexes = {}
    for source, result in providers.items():
        indexes[source] = {
            int(r.get("PLAYER_ID") or r.get("CLOSE_DEF_PERSON_ID") or 0): r
            for r in result.get("rows", [])
        }
    output = []
    for player_id, appearances in grouped.items():
        player = players.get(
            player_id, {"id": player_id, "name": str(player_id), "position": None}
        )
        if scope.position and scope.position not in (player.get("position") or ""):
            continue
        appearances.sort(key=lambda g: (g["date"], g["gameId"]))
        if scope.split.startswith("last"):
            appearances = appearances[-int(scope.split[4:]) :]
        gp = len(appearances)
        minutes = sum(g["min"] for g in appearances)
        if gp < scope.minGames or minutes < scope.minMinutes:
            continue
        sums = {
            key: sum(g[key] for g in appearances)
            for key in (
                "pts",
                "reb",
                "ast",
                "stl",
                "blk",
                "tov",
                "fgm",
                "fga",
                "fg3m",
                "fg3a",
                "ftm",
                "fta",
            )
        }
        for key in ("oreb", "dreb", "pf", "plusMinus"):
            sums[key] = (
                sum(g[key] for g in appearances)
                if all(key in g for g in appearances)
                else None
            )
        advanced = indexes.get("advanced", {}).get(player_id, {})
        matched = advanced.get("GP") == gp
        possessions = advanced.get("POSS") if matched else None
        divisor = {
            "per_game": gp,
            "per36": minutes / 36,
            "totals": 1,
            "per75": possessions / 75 if possessions else None,
            "per100": possessions / 100 if possessions else None,
        }[scope.mode]
        two_made, two_att = sums["fgm"] - sums["fg3m"], sums["fga"] - sums["fg3a"]
        tsa = sums["fga"] + 0.44 * sums["fta"]
        ts = ratio(sums["pts"], 2 * tsa)
        derived = {
            "fg": ratio(sums["fgm"], sums["fga"]),
            "three": ratio(sums["fg3m"], sums["fg3a"]),
            "ft": ratio(sums["ftm"], sums["fta"]),
            "two": ratio(two_made, two_att),
            "efg": ratio(sums["fgm"] + 0.5 * sums["fg3m"], sums["fga"]),
            "ts": ts,
            "rts": ts - league_ts if ts is not None and league_ts is not None else None,
            "threeRate": ratio(sums["fg3a"], sums["fga"]),
            "ftr": ratio(sums["fta"], sums["fga"]),
            "tovPct": ratio(sums["tov"], tsa + sums["tov"]),
            "astTo": ratio(sums["ast"], sums["tov"], 1),
            "ptsPerFga": ratio(sums["pts"], sums["fga"], 1),
            "ftaRate": ratio(0.44 * sums["fta"], tsa),
            "pts2Share": ratio(two_made * 2, sums["pts"]),
            "pts3Share": ratio(sums["fg3m"] * 3, sums["pts"]),
            "ptsFtShare": ratio(sums["ftm"], sums["pts"]),
            "twoMade": two_made,
            "twoAttempts": two_att,
            "tsa": tsa,
        }
        values, missing = {}, {}
        for key in metric_ids:
            metric = METRICS[key]
            source = metric["source"]
            value, reason = None, "No attempts in the selected sample"
            if key == "gp":
                value = gp
            elif key == "min":
                value = minutes if scope.mode == "totals" else minutes / gp
            elif source in ("box", "derived"):
                value = (
                    sums.get(metric["field"]) if source == "box" else derived.get(key)
                )
                if metric["kind"] == "count":
                    value = value / divisor if value is not None and divisor else None
                    reason = (
                        "No matching NBA possession sample"
                        if not divisor
                        else "Source box-score field unavailable"
                    )
            elif source == "unavailable":
                reason = "Unavailable: no validated model feed or implementation is connected"
            else:
                provider = providers.get(source, {})
                row = indexes.get(source, {}).get(player_id)
                reason = (
                    provider.get("reason")
                    or "Player not covered by this source in the selected scope"
                )
                if row:
                    # Clutch is intentionally a subset. Shot-location checks use attempts,
                    # since that endpoint has no GP column. Other feeds must match GP.
                    covered = (
                        source in ("clutch", "zones")
                        or row.get("GP", row.get("G")) == gp
                    )
                    if source == "zones":
                        covered = row.get("_FGA") == sums["fga"]
                    if not covered:
                        reason = (
                            "Source sample differs from the selected player-game sample"
                        )
                    else:
                        raw = row.get(metric["field"])
                        if isinstance(raw, (int, float)) and math.isfinite(raw):
                            value = raw * metric["factor"]
                            attempt_field = None
                            for suffix, replacement in [
                                ("EFG_PCT", "FGA"),
                                ("FG3_PCT", "FG3A"),
                                ("FG_PCT", "FGA"),
                                ("FT_PCT", "FTA"),
                            ]:
                                if metric["field"].endswith(suffix):
                                    attempt_field = (
                                        metric["field"][: -len(suffix)] + replacement
                                    )
                                    break
                            if attempt_field in row and not row[attempt_field]:
                                value = None
                                reason = "No shooting attempts in this source sample"
                            if (
                                source == "zones"
                                and metric["field"].endswith(":fg")
                                and not row.get(
                                    metric["field"].replace(":fg", ":attempts")
                                )
                            ):
                                value = None
                                reason = "No attempts in this shot zone"
                            if metric["kind"] == "count":
                                metric_divisor = divisor
                                if source == "clutch":
                                    metric_divisor = {
                                        "totals": 1,
                                        "per_game": row.get("GP"),
                                        "per36": row.get("MIN", 0) / 36,
                                        "per75": None,
                                        "per100": None,
                                    }[scope.mode]
                                value = (
                                    value / metric_divisor if metric_divisor else None
                                )
                                reason = (
                                    "Clutch possession denominator is unavailable"
                                    if source == "clutch"
                                    and scope.mode in ("per75", "per100")
                                    else "No matching NBA possession sample"
                                    if not metric_divisor
                                    else reason
                                )
            if value is not None and not math.isfinite(value):
                value = None
            values[key] = value
            if value is None:
                missing[key] = reason
        team_ids = list(dict.fromkeys(g["team"] for g in appearances))
        output.append(
            {
                "player": {
                    **player,
                    "team": team_ids[0] if len(team_ids) == 1 else "MULTI",
                },
                "teamIds": team_ids,
                "games": gp,
                "minutes": minutes,
                "from": appearances[0]["date"],
                "to": appearances[-1]["date"],
                "values": values,
                "missing": missing,
                "percentiles": {},
            }
        )
    for key in metric_ids:
        ranks = percentile_values(
            [row["values"][key] for row in output], METRICS[key]["higherIsBetter"]
        )
        for row, rank in zip(output, ranks):
            row["percentiles"][key] = rank
    return output
