"""Generate the shared catalog from explicit box-score formulas and NBA source fields.

Run with the data environment. Provider field inventories are checked against public
nba_api endpoint response schemas; the generated file is the runtime contract.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
metrics = []


def add(
    key,
    label,
    short,
    group,
    kind="count",
    source="box",
    field=None,
    formula=None,
    factor=1,
    better=True,
    unit="",
    coverage="range",
):
    metrics.append(
        {
            "id": key,
            "label": label,
            "short": short,
            "group": group,
            "kind": kind,
            "source": source,
            "field": field,
            "formula": formula,
            "factor": factor,
            "higherIsBetter": better,
            "unit": unit,
            "coverage": coverage,
            "version": 1,
            "definition": formula
            or f"{label}, as reported by NBA {group.lower()} statistics for the selected scope.",
        }
    )


for key, label, short, field in [
    ("pts", "Points", "PTS", "pts"),
    ("reb", "Rebounds", "REB", "reb"),
    ("ast", "Assists", "AST", "ast"),
    ("stl", "Steals", "STL", "stl"),
    ("blk", "Blocks", "BLK", "blk"),
    ("tov", "Turnovers", "TOV", "tov"),
    ("oreb", "Offensive rebounds", "OREB", "oreb"),
    ("dreb", "Defensive rebounds", "DREB", "dreb"),
    ("pf", "Personal fouls", "PF", "pf"),
    ("fgm", "Field goals made", "FGM", "fgm"),
    ("fga", "Field goals attempted", "FGA", "fga"),
    ("fg3m", "Three-pointers made", "3PM", "fg3m"),
    ("fg3a", "Three-pointers attempted", "3PA", "fg3a"),
    ("ftm", "Free throws made", "FTM", "ftm"),
    ("fta", "Free throws attempted", "FTA", "fta"),
    ("plusMinus", "Plus/minus", "+/−", "plusMinus"),
]:
    add(key, label, short, "Counting", field=field, better=key not in ("tov", "pf"))
add(
    "gp",
    "Games played",
    "GP",
    "Counting",
    "number",
    formula="Count of distinct recorded player-game appearances in the selected scope.",
)
add(
    "min",
    "Minutes played",
    "MIN",
    "Counting",
    "number",
    unit="min",
    formula="Total minutes in totals mode; minutes per appearance in other modes.",
)
for key, label, short, formula, better, unit in [
    ("fg", "Field-goal percentage", "FG%", "100 × SUM(FGM) / SUM(FGA)", True, "%"),
    ("three", "Three-point percentage", "3P%", "100 × SUM(3PM) / SUM(3PA)", True, "%"),
    ("ft", "Free-throw percentage", "FT%", "100 × SUM(FTM) / SUM(FTA)", True, "%"),
    (
        "two",
        "Two-point percentage",
        "2P%",
        "100 × (SUM(FGM) − SUM(3PM)) / (SUM(FGA) − SUM(3PA))",
        True,
        "%",
    ),
    (
        "efg",
        "Effective field-goal percentage",
        "eFG%",
        "100 × (SUM(FGM) + 0.5 × SUM(3PM)) / SUM(FGA)",
        True,
        "%",
    ),
    (
        "ts",
        "True shooting percentage",
        "TS%",
        "100 × SUM(PTS) / (2 × (SUM(FGA) + 0.44 × SUM(FTA)))",
        True,
        "%",
    ),
    (
        "rts",
        "Relative true shooting",
        "rTS",
        "Player TS% minus league TS%, in percentage points. League baseline uses all recorded games in the date and season-type window, independent of display filters.",
        True,
        "pp",
    ),
    (
        "threeRate",
        "Three-point attempt rate",
        "3PAr",
        "100 × SUM(3PA) / SUM(FGA)",
        True,
        "%",
    ),
    ("ftr", "Free-throw attempt rate", "FTr", "100 × SUM(FTA) / SUM(FGA)", True, "%"),
    (
        "tovPct",
        "Box-score turnover rate",
        "TOV%",
        "100 × SUM(TOV) / (SUM(FGA) + 0.44 × SUM(FTA) + SUM(TOV)); this is a box-score approximation.",
        False,
        "%",
    ),
    (
        "astTo",
        "Assist-to-turnover ratio",
        "AST/TO",
        "SUM(AST) / SUM(TOV); unavailable when no turnovers are recorded.",
        True,
        "",
    ),
    (
        "ptsPerFga",
        "Points per field-goal attempt",
        "PTS/FGA",
        "SUM(PTS) / SUM(FGA), including free-throw points.",
        True,
        "",
    ),
    (
        "ftaRate",
        "Free-throw share of scoring attempts",
        "FTA rate",
        "100 × (0.44 × SUM(FTA)) / (SUM(FGA) + 0.44 × SUM(FTA))",
        True,
        "%",
    ),
    (
        "pts2Share",
        "Two-point share of points",
        "2PT share",
        "100 × 2 × (SUM(FGM) − SUM(3PM)) / SUM(PTS)",
        True,
        "%",
    ),
    (
        "pts3Share",
        "Three-point share of points",
        "3PT share",
        "100 × 3 × SUM(3PM) / SUM(PTS)",
        True,
        "%",
    ),
    (
        "ptsFtShare",
        "Free-throw share of points",
        "FT share",
        "100 × SUM(FTM) / SUM(PTS)",
        True,
        "%",
    ),
]:
    add(
        key,
        label,
        short,
        "Efficiency",
        "percent" if unit in ("%", "pp") else "rate",
        source="derived",
        formula=formula,
        better=better,
        unit=unit,
    )
add(
    "twoMade",
    "Two-pointers made",
    "2PM",
    "Counting",
    source="derived",
    formula="SUM(FGM) − SUM(3PM)",
)
add(
    "twoAttempts",
    "Two-pointers attempted",
    "2PA",
    "Counting",
    source="derived",
    formula="SUM(FGA) − SUM(3PA)",
)
add(
    "tsa",
    "True shooting attempts",
    "TSA",
    "Counting",
    source="derived",
    formula="SUM(FGA) + 0.44 × SUM(FTA)",
)

advanced = [
    ("offRtg", "Offensive rating", "ORtg", "OFF_RATING", 1),
    ("defRtg", "Defensive rating", "DRtg", "DEF_RATING", 1),
    ("netRtg", "Net rating", "NetRtg", "NET_RATING", 1),
    ("usage", "Usage percentage", "USG%", "USG_PCT", 100),
    ("astPct", "Assist percentage", "AST%", "AST_PCT", 100),
    ("orebPct", "Offensive rebound percentage", "OREB%", "OREB_PCT", 100),
    ("drebPct", "Defensive rebound percentage", "DREB%", "DREB_PCT", 100),
    ("rebPct", "Rebound percentage", "REB%", "REB_PCT", 100),
    ("astRatio", "Assist ratio", "AST ratio", "AST_RATIO", 1),
    ("nbaTovPct", "NBA turnover ratio", "NBA TOV%", "TM_TOV_PCT", 1),
    ("pace", "Pace", "PACE", "PACE", 1),
    ("pie", "Player impact estimate", "PIE", "PIE", 100),
    ("poss", "NBA on-court possessions", "POSS", "POSS", 1),
    ("estOffRtg", "Estimated offensive rating", "eORtg", "E_OFF_RATING", 1),
    ("estDefRtg", "Estimated defensive rating", "eDRtg", "E_DEF_RATING", 1),
    ("estNetRtg", "Estimated net rating", "eNetRtg", "E_NET_RATING", 1),
    ("estUsage", "Estimated usage percentage", "eUSG%", "E_USG_PCT", 100),
    ("estPace", "Estimated pace", "ePACE", "E_PACE", 1),
]
for key, label, short, field, factor in advanced:
    add(
        key,
        label,
        short,
        "Advanced",
        "count" if key == "poss" else "percent" if factor == 100 else "rating",
        source="advanced",
        field=field,
        factor=factor,
        unit="%" if factor == 100 else "",
        better=key not in ("defRtg", "estDefRtg", "nbaTovPct"),
    )

# No undocumented impact coefficients are substituted for external models.
for key, label, short in [
    ("dpm", "Daily plus-minus", "DPM"),
    ("odpm", "Offensive daily plus-minus", "ODPM"),
    ("ddpm", "Defensive daily plus-minus", "DDPM"),
    ("epm", "Estimated plus-minus model", "EPM"),
    ("lebron", "LEBRON impact model", "LEBRON"),
    ("bpm", "Box plus-minus model", "BPM"),
    ("vorp", "Value over replacement player", "VORP"),
]:
    add(
        key,
        label,
        short,
        "Impact models",
        "model",
        source="unavailable",
        formula="Unavailable: this model feed or its independently validated implementation is not connected. NBA box-score or rating values are not substituted.",
        coverage="provider",
    )

SKIP = {
    "PLAYER_ID",
    "PLAYER_NAME",
    "PLAYER_LAST_TEAM_ID",
    "PLAYER_LAST_TEAM_ABBREVIATION",
    "PLAYER_POSITION",
    "CLOSE_DEF_PERSON_ID",
    "GROUP_SET",
    "NICKNAME",
    "TEAM_ID",
    "TEAM_ABBREVIATION",
    "AGE",
    "GP",
    "G",
    "W",
    "L",
    "W_PCT",
    "MIN",
    "TEAM_COUNT",
    "WNBA_FANTASY_PTS",
    "FP_HIGH_SCORE",
}
WORDS = {
    "FGM": "field goals made",
    "FGA": "field goals attempted",
    "FG": "field goal",
    "FG3M": "three-pointers made",
    "FG3A": "three-pointers attempted",
    "FG3": "three-point",
    "FTM": "free throws made",
    "FTA": "free throws attempted",
    "FT": "free throw",
    "PCT": "percentage",
    "PTS": "points",
    "AST": "assists",
    "TOV": "turnovers",
    "PF": "fouls",
    "OFF": "offensive",
    "DEF": "defensive",
    "OREB": "offensive rebounds",
    "DREB": "defensive rebounds",
    "REB": "rebounds",
    "CONTEST": "contested",
    "UNCONTEST": "uncontested",
    "AVG": "average",
    "DIST": "distance",
    "SEC": "seconds",
    "SPD": "speed",
}


def human(field):
    return " ".join(
        WORDS.get(part, part.lower()) for part in field.split("_")
    ).capitalize()


def include_fields(source, group, prefix, headers):
    for field in headers:
        if (
            field in SKIP
            or field.endswith("_RANK")
            or field.startswith("sp_work_")
            or not isinstance(field, str)
        ):
            continue
        key = prefix + "".join(part.title() for part in field.lower().split("_"))
        pct = "_PCT" in field or field.startswith("PCT_") or field == "FREQ"
        kind = (
            "percent"
            if pct
            else "rate"
            if field.startswith("AVG_") or "_PER_" in field
            else "count"
        )
        label = human(field)
        add(
            key,
            label,
            field.replace("_", " "),
            group,
            kind,
            source,
            field,
            factor=100 if pct else 1,
            unit="%" if pct else "",
            better=not any(token in field for token in ("TOV", "OPP_PTS", "FOULS"))
            and field
            not in {
                "D_FGM",
                "D_FG_PCT",
                "PCT_PLUSMINUS",
                "DEF_RIM_FGM",
                "DEF_RIM_FG_PCT",
                "PF",
                "BLKA",
            },
        )
        if field == "PCT_PLUSMINUS":
            metrics[-1]["unit"] = "pp"
            metrics[-1]["definition"] = (
                "Defended-shot field-goal percentage minus the shooters’ normal field-goal percentage, in percentage points. Lower means worse opponent shooting relative to baseline; descriptive rather than causal."
            )
        if source == "clutch" and kind == "count":
            metrics[-1]["definition"] += (
                " Counts use clutch games in per-game mode and clutch minutes in per-36 mode. Per-possession clutch counts are unavailable without a matching clutch possession denominator."
            )


inventories = json.loads(
    (ROOT / "packages/analytics-contracts/source-fields.json").read_text(
        encoding="utf-8"
    )
)
families = [
    ("scoring", "Scoring", "score"),
    ("misc", "Miscellaneous", "misc"),
    ("hustle", "Hustle", "hustle"),
    ("drives", "Drives", "drive"),
    ("Passing", "Passing", "pass"),
    ("Rebounding", "Rebounding", "rebound"),
    ("Possessions", "Touches", "touch"),
    ("CatchShoot", "Catch-and-shoot", "catch"),
    ("PullUpShot", "Pull-up shooting", "pullup"),
    ("SpeedDistance", "Speed and distance", "movement"),
    ("PaintTouch", "Paint touches", "paint"),
    ("PostTouch", "Post touches", "post"),
    ("ElbowTouch", "Elbow touches", "elbow"),
    ("Defense", "Tracking defense", "trackDefense"),
    ("defend", "Defending shots", "defend"),
    ("clutch", "Clutch", "clutch"),
]
for name, group, prefix in families:
    include_fields(name, group, prefix, inventories[name])

for zone, label in [
    ("ra", "Restricted area"),
    ("paint", "Paint outside restricted area"),
    ("mid", "Mid-range"),
    ("leftCorner", "Left corner three"),
    ("rightCorner", "Right corner three"),
    ("aboveBreak", "Above-the-break three"),
    ("backcourt", "Backcourt"),
    ("corner", "Combined corner three"),
]:
    for field, kind, unit in [
        ("made", "count", ""),
        ("attempts", "count", ""),
        ("fg", "percent", "%"),
    ]:
        add(
            f"{zone}{field.title()}",
            f"{label}: {field}",
            f"{label} {'FG%' if field == 'fg' else 'FGM' if field == 'made' else 'FGA'}",
            "Shot zones",
            kind,
            "zones",
            f"{zone}:{field}",
            unit=unit,
            factor=100 if field == "fg" else 1,
        )

catalog = {
    "schemaVersion": 1,
    "formulaVersion": "nba-box-v1",
    "metrics": metrics,
    "sources": {
        "box": "Validated NBA player-game box scores",
        "derived": "Documented local formula from summed box-score components",
        "advanced": "NBA LeagueDashPlayerStats / Advanced",
        "scoring": "NBA LeagueDashPlayerStats / Scoring",
        "misc": "NBA LeagueDashPlayerStats / Misc",
        "hustle": "NBA LeagueHustleStatsPlayer",
        "zones": "NBA LeagueDashPlayerShotLocations; strict NBA zones",
        **{
            name: f"NBA LeagueDashPtStats / {name}"
            for name, _, _ in families
            if name not in ("scoring", "misc", "hustle", "defend", "clutch")
        },
        "defend": "NBA LeagueDashPtDefend",
        "clutch": "NBA LeagueDashPlayerClutch; final five minutes, margin within five points",
        "unavailable": "No validated connected source",
    },
    "presets": {
        "Overview": [
            "gp",
            "min",
            "pts",
            "reb",
            "ast",
            "ts",
            "rts",
            "usage",
            "offRtg",
            "defRtg",
            "netRtg",
            "pie",
        ],
        "Counting": [
            "gp",
            "min",
            "pts",
            "fgm",
            "fga",
            "fg3m",
            "fg3a",
            "ftm",
            "fta",
            "oreb",
            "dreb",
            "reb",
            "ast",
            "stl",
            "blk",
            "tov",
            "pf",
        ],
        "Shooting": [
            "pts",
            "fg",
            "two",
            "three",
            "ft",
            "efg",
            "ts",
            "rts",
            "threeRate",
            "ftr",
            "pts2Share",
            "pts3Share",
            "ptsFtShare",
        ],
        "Advanced": [
            "gp",
            "min",
            "usage",
            "offRtg",
            "defRtg",
            "netRtg",
            "astPct",
            "orebPct",
            "drebPct",
            "rebPct",
            "nbaTovPct",
            "pace",
            "pie",
            "poss",
        ],
        "Impact": [
            "gp",
            "min",
            "dpm",
            "odpm",
            "ddpm",
            "epm",
            "bpm",
            "vorp",
            "netRtg",
            "pie",
        ],
    },
}
ids = {metric["id"] for metric in metrics}
if len(ids) != len(metrics):
    raise ValueError("Duplicate metric ID")
for group in sorted({metric["group"] for metric in metrics}):
    catalog["presets"].setdefault(
        group, [metric["id"] for metric in metrics if metric["group"] == group][:16]
    )
path = ROOT / "packages" / "analytics-contracts" / "metrics.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(
    json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(f"Wrote {len(metrics)} metric definitions to {path.relative_to(ROOT)}")
