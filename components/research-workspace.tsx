"use client";
import { useEffect, useState } from "react";
import {
  Columns3,
  GitCompareArrows,
  Network,
  ScatterChart,
  Shield,
  Users,
} from "lucide-react";
import {
  analysisScope,
  columnPresets,
  metricById,
  metricCatalog,
  type AnalysisScope,
  type StatsRequest,
  type StatsResult,
} from "@/lib/advanced";
import type { Scope } from "@/lib/analytics";
import { useAnalysis } from "./use-analysis";
import { StatsWorkbench } from "./stats-workbench";
import { ResearchScatter } from "./research-scatter";
import { SourceExplorer } from "./source-explorer";
import { ResearchComparison } from "./research-comparison";
import { PostseasonExplorer } from "./postseason-explorer";
import { TeamComparison } from "./team-comparison";
import { HistoryExplorer } from "./history-explorer";
import { playoffSeasons, players, seasons } from "@/lib/data";

type Section =
  | "stats"
  | "scatter"
  | "compare"
  | "lineups"
  | "onoff"
  | "teammates"
  | "matchups"
  | "teamAdvanced"
  | "teamFourFactors"
  | "zones"
  | "playtypes"
  | "playoffs"
  | "teamCompare"
  | "history";
const sections: { id: Section; label: string; icon: typeof Columns3 }[] = [
  { id: "stats", label: "Statistics", icon: Columns3 },
  { id: "scatter", label: "Scatter", icon: ScatterChart },
  { id: "compare", label: "Compare seasons", icon: GitCompareArrows },
  { id: "zones", label: "Shot zones", icon: ScatterChart },
  { id: "teamAdvanced", label: "Team ratings", icon: Users },
  { id: "lineups", label: "Lineups", icon: Network },
  { id: "teamFourFactors", label: "Four factors", icon: Columns3 },
  { id: "playtypes", label: "Play types", icon: ScatterChart },
  { id: "onoff", label: "On / off", icon: Users },
  { id: "matchups", label: "Matchups", icon: Shield },
  { id: "teammates", label: "Teammates", icon: Users },
  { id: "playoffs", label: "Playoffs", icon: Network },
  { id: "teamCompare", label: "Compare teams", icon: GitCompareArrows },
  { id: "history", label: "History", icon: Columns3 },
];
export function ResearchWorkspace({
  scope,
  onPlayer,
  fullSeason,
}: {
  scope: Scope;
  onPlayer: (id: number, scope: AnalysisScope) => void;
  fullSeason: boolean;
}) {
  const [section, setSection] = useState<Section>("stats");
  const [columns, setColumns] = useState(columnPresets.Counting);
  const [mode, setMode] = useState<AnalysisScope["mode"]>(scope.perMode);
  const [split, setSplit] = useState("all");
  const [minMinutes, setMinMinutes] = useState(0);
  const [sort, setSort] = useState("pts");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<StatsRequest["filters"]>([]);
  const [x, setX] = useState("pts");
  const [y, setY] = useState("ts");
  const [compare, setCompare] = useState<number[]>([]);
  const [restored, setRestored] = useState(false);
  const [seasonType, setSeasonType] =
    useState<AnalysisScope["seasonType"]>("Regular Season");
  const [postFrom, setPostFrom] = useState("");
  const [postTo, setPostTo] = useState("");
  const [lineupMatrix, setLineupMatrix] = useState(false);
  const [comparisonSeasons, setComparisonSeasons] = useState<
    Record<string, string>
  >({});
  useEffect(() => {
    try {
      const saved = JSON.parse(
        new URLSearchParams(window.location.search).get("lab") || "null",
      );
      if (saved && typeof saved === "object") {
        if (sections.some((item) => item.id === saved.section))
          setSection(saved.section);
        if (
          Array.isArray(saved.columns) &&
          saved.columns.length > 0 &&
          saved.columns.length <= 60 &&
          saved.columns.every(
            (id: unknown) =>
              typeof id === "string" && Object.hasOwn(metricById, id),
          )
        )
          setColumns(saved.columns);
        if (
          ["per_game", "per36", "per75", "per100", "totals"].includes(
            saved.mode,
          )
        )
          setMode(saved.mode);
        if (
          [
            "all",
            "home",
            "away",
            "wins",
            "losses",
            "last5",
            "last10",
            "last20",
          ].includes(saved.split)
        )
          setSplit(saved.split);
        if (saved.seasonType === "Playoffs" || saved.section === "playoffs")
          setSeasonType("Playoffs");
        if (typeof saved.matrix === "boolean") setLineupMatrix(saved.matrix);
        if (
          saved.comparisonSeasons &&
          typeof saved.comparisonSeasons === "object"
        )
          setComparisonSeasons(
            Object.fromEntries(
              Object.entries(saved.comparisonSeasons)
                .filter(
                  ([id, season]) =>
                    players.some((player) => String(player.id) === id) &&
                    seasons.some((item) => item.id === season),
                )
                .slice(0, 5),
            ) as Record<string, string>,
          );
        if (
          typeof saved.sort === "string" &&
          Object.hasOwn(metricById, saved.sort)
        )
          setSort(saved.sort);
        if (typeof saved.ascending === "boolean") setAscending(saved.ascending);
        if (typeof saved.x === "string" && Object.hasOwn(metricById, saved.x))
          setX(saved.x);
        if (typeof saved.y === "string" && Object.hasOwn(metricById, saved.y))
          setY(saved.y);
        if (
          typeof saved.minMinutes === "number" &&
          Number.isFinite(saved.minMinutes) &&
          saved.minMinutes >= 0 &&
          saved.minMinutes <= 6000
        )
          setMinMinutes(saved.minMinutes);
        if (
          Array.isArray(saved.filters) &&
          saved.filters.length <= 10 &&
          saved.filters.every(
            (item: StatsRequest["filters"][number]) =>
              item &&
              Object.hasOwn(metricById, item.metric) &&
              ["gte", "lte"].includes(item.op) &&
              typeof item.value === "number" &&
              Number.isFinite(item.value),
          )
        )
          setFilters(saved.filters);
        if (Array.isArray(saved.compare))
          setCompare(
            [
              ...new Set<number>(
                saved.compare.filter((id: number) =>
                  players.some((player) => player.id === id),
                ),
              ),
            ].slice(0, 5),
          );
        if (
          typeof saved.postFrom === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(saved.postFrom)
        )
          setPostFrom(saved.postFrom);
        if (
          typeof saved.postTo === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(saved.postTo)
        )
          setPostTo(saved.postTo);
      }
    } catch {
      /* Malformed shared state falls back to valid defaults. */
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    const params = new URLSearchParams(window.location.search);
    params.set(
      "lab",
      JSON.stringify({
        section,
        columns,
        mode,
        split,
        seasonType,
        sort,
        ascending,
        x,
        y,
        minMinutes,
        filters,
        compare,
        postFrom,
        postTo,
        matrix: lineupMatrix,
        comparisonSeasons,
      }),
    );
    window.history.replaceState(null, "", `?${params}`);
  }, [
    section,
    columns,
    mode,
    split,
    seasonType,
    sort,
    ascending,
    x,
    y,
    minMinutes,
    filters,
    compare,
    postFrom,
    postTo,
    lineupMatrix,
    comparisonSeasons,
    restored,
  ]);
  useEffect(
    () => setPage(0),
    [
      scope,
      columns,
      mode,
      split,
      minMinutes,
      filters,
      sort,
      ascending,
      seasonType,
      postFrom,
      postTo,
    ],
  );
  const postBounds = playoffSeasons.find((item) => item.id === scope.season);
  const effectiveScope: AnalysisScope = {
    ...analysisScope(scope),
    ...(fullSeason ? { start: null, end: null } : {}),
    mode,
    split,
    minMinutes,
    seasonType,
    ...(seasonType === "Playoffs"
      ? {
          start: postFrom || postBounds?.from || null,
          end: postTo || postBounds?.to || null,
        }
      : {}),
  };
  const request: StatsRequest = {
    scope: effectiveScope,
    metrics: section === "scatter" ? [x, y, "gp", "min"] : columns,
    search: scope.search,
    sort: section === "scatter" ? x : sort,
    ascending,
    offset: section === "scatter" ? 0 : page * 50,
    limit: section === "scatter" ? 500 : 50,
    filters,
  };
  const stats = useAnalysis<StatsResult>(
    "stats",
    request,
    section === "stats" || section === "scatter",
  );
  function addCompare(id: number) {
    if (compare.includes(id))
      setComparisonSeasons((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => key !== String(id)),
        ),
      );
    setCompare((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id].slice(0, 5),
    );
  }
  return (
    <section className="research-workspace" aria-label="Advanced NBA research">
      <nav className="research-tabs" aria-label="Analysis views">
        {sections.map((item) => (
          <button
            key={item.id}
            aria-current={section === item.id ? "page" : undefined}
            className={section === item.id ? "active" : ""}
            onClick={() => {
              setSection(item.id);
              if (item.id === "playoffs") setSeasonType("Playoffs");
              if (item.id === "history" || item.id === "teamCompare")
                setSeasonType("Regular Season");
            }}
          >
            <item.icon size={16} />
            {item.label}
            {item.id === "compare" &&
              compare.length > 0 &&
              ` (${compare.length})`}
          </button>
        ))}
      </nav>
      <div className="research-scope">
        <label>
          Season type
          <select
            aria-label="Analysis season type"
            disabled={["playoffs", "history", "teamCompare"].includes(section)}
            value={seasonType}
            onChange={(event) => {
              setSeasonType(event.target.value as AnalysisScope["seasonType"]);
              setPostFrom("");
              setPostTo("");
            }}
          >
            <option>Regular Season</option>
            <option>Playoffs</option>
          </select>
        </label>
        {seasonType === "Playoffs" && (
          <>
            <label>
              Playoff dates from
              <input
                aria-label="Playoff dates from"
                type="date"
                value={postFrom || postBounds?.from || ""}
                max={postTo || postBounds?.to}
                onChange={(event) => setPostFrom(event.target.value)}
              />
            </label>
            <label>
              Playoff dates to
              <input
                aria-label="Playoff dates to"
                type="date"
                min={postFrom || postBounds?.from}
                value={postTo || postBounds?.to || ""}
                onChange={(event) => setPostTo(event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Stat basis
          <select
            aria-label="Advanced stat basis"
            disabled={
              !["stats", "scatter", "compare", "history"].includes(section)
            }
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as AnalysisScope["mode"])
            }
          >
            <option value="per_game">Per game</option>
            <option value="per36">Per 36 minutes</option>
            <option value="per75">Per 75 possessions</option>
            <option value="per100">Per 100 possessions</option>
            <option value="totals">Totals</option>
          </select>
        </label>
        <label>
          Split
          <select
            aria-label="Analysis split"
            value={split}
            onChange={(event) => setSplit(event.target.value)}
          >
            <option value="all">All games</option>
            <option value="last5">Last 5 games</option>
            <option value="last10">Last 10 games</option>
            <option value="last20">Last 20 games</option>
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="wins">Wins</option>
            <option value="losses">Losses</option>
          </select>
        </label>
        <label>
          Minimum total minutes
          <input
            aria-label="Minimum total minutes"
            disabled={
              !["stats", "scatter", "compare", "history", "zones"].includes(
                section,
              )
            }
            type="number"
            min={0}
            max={6000}
            value={minMinutes}
            onChange={(event) =>
              setMinMinutes(
                Math.min(6000, Math.max(0, Number(event.target.value))),
              )
            }
          />
        </label>
        <p>
          {seasonType === "Playoffs"
            ? "Playoff dates above replace the regular-season window."
            : "Dates, team and eligibility follow the filters above."}{" "}
          <strong>{metricCatalog.length} documented metrics.</strong>
        </p>
      </div>
      {(section === "stats" || section === "scatter") && stats.loading && (
        <div className="research-status" role="status">
          Loading the selected sample. NBA tracking feeds can take a few
          seconds…
        </div>
      )}
      {(section === "stats" || section === "scatter") && stats.error && (
        <div className="research-status" role="alert">
          <h2>Analytics could not load</h2>
          <p>{stats.error}</p>
          <button className="button" onClick={stats.retry}>
            Retry analytics
          </button>
        </div>
      )}
      {section === "stats" && (
        <StatsWorkbench
          data={stats.data}
          request={request}
          columns={columns}
          setColumns={(next) => {
            setColumns(next);
            if (!next.includes(sort))
              setSort(
                next.find((key) => key !== "gp" && key !== "min") || next[0],
              );
          }}
          filters={filters}
          setFilters={setFilters}
          page={page}
          setPage={setPage}
          sort={sort}
          ascending={ascending}
          onSort={(key) => {
            setAscending(key === sort ? !ascending : false);
            setSort(key);
          }}
          onPlayer={(id) => onPlayer(id, effectiveScope)}
          selected={compare}
          onCompare={addCompare}
        />
      )}
      {section === "scatter" && stats.data && (
        <ResearchScatter
          data={stats.data}
          x={x}
          y={y}
          onX={setX}
          onY={setY}
          onPlayer={(id) => onPlayer(id, effectiveScope)}
        />
      )}
      {section === "compare" && (
        <ResearchComparison
          ids={compare}
          onRemove={addCompare}
          scope={effectiveScope}
          selectedSeasons={comparisonSeasons}
          onSeason={(id, season) =>
            setComparisonSeasons((previous) => ({
              ...Object.fromEntries(
                Object.entries(previous).filter(([key]) =>
                  compare.includes(Number(key)),
                ),
              ),
              [id]: season,
            }))
          }
        />
      )}
      {section === "playoffs" && <PostseasonExplorer scope={effectiveScope} />}
      {section === "teamCompare" && <TeamComparison scope={effectiveScope} />}
      {section === "history" && <HistoryExplorer scope={effectiveScope} />}
      {![
        "stats",
        "scatter",
        "compare",
        "playoffs",
        "teamCompare",
        "history",
      ].includes(section) && (
        <SourceExplorer
          key={section}
          feature={section}
          matrix={section === "lineups" && lineupMatrix}
          onMatrix={setLineupMatrix}
          scope={effectiveScope}
          onPlayer={(id) => onPlayer(id, effectiveScope)}
        />
      )}
    </section>
  );
}
