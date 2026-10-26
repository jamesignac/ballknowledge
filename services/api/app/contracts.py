"""Bounded public query contract and shared versioned metric definitions."""

import json
from datetime import date
from typing import Annotated, Literal
from pydantic import BaseModel, Field, model_validator
from .database import ROOT

CATALOG = json.loads(
    (ROOT / "packages/analytics-contracts/metrics.json").read_text(encoding="utf-8")
)
METRICS = {m["id"]: m for m in CATALOG["metrics"]}


class Scope(BaseModel):
    season: str = Field(default="2026-27", pattern=r"^20\d{2}-\d{2}$")
    seasonType: Literal["Regular Season", "Playoffs"] = "Regular Season"
    start: date | None = None
    end: date | None = None
    team: str = Field(default="", pattern=r"^([A-Z]{3})?$")
    position: str = Field(default="", pattern=r"^([GFC])?$")
    split: Literal[
        "all", "home", "away", "wins", "losses", "last5", "last10", "last20"
    ] = "all"
    minGames: int = Field(default=1, ge=0, le=100)
    minMinutes: float = Field(default=0, ge=0, le=6000)
    mode: Literal["per_game", "per36", "per75", "per100", "totals"] = "per_game"

    @model_validator(mode="after")
    def dates(self):
        if self.start and self.end and self.start > self.end:
            raise ValueError("Start date must not follow end date")
        return self


class MetricFilter(BaseModel):
    metric: str
    op: Literal["gte", "lte"] = "gte"
    value: float = Field(allow_inf_nan=False)


class StatsQuery(BaseModel):
    scope: Scope = Field(default_factory=Scope)
    metrics: list[str] = Field(
        default_factory=lambda: CATALOG["presets"]["Overview"], max_length=350
    )
    search: str = Field(default="", max_length=100)
    sort: str = "pts"
    ascending: bool = False
    offset: int = Field(default=0, ge=0, le=100000)
    limit: int = Field(default=50, ge=1, le=500)
    filters: list[MetricFilter] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def metric_ids(self):
        requested = {*self.metrics, self.sort, *(f.metric for f in self.filters)}
        if not requested <= METRICS.keys():
            raise ValueError("Unknown metric ID")
        self.metrics = list(dict.fromkeys(self.metrics))
        return self


class HistoryQuery(StatsQuery):
    seasons: list[Annotated[str, Field(pattern=r"^20\d{2}-\d{2}$", max_length=7)]] = (
        Field(
            default_factory=lambda: ["2023-24", "2024-25", "2025-26", "2026-27"],
            min_length=1,
            max_length=12,
        )
    )
    pooled: bool = False
