"use client";
import {
  metricById,
  metricFormat,
  type AnalysisScope,
  type StatsResult,
} from "@/lib/advanced";
import { players, seasons, playoffSeasons } from "@/lib/data";
import { useAnalysis } from "./use-analysis";

const comparedMetrics = [
  "gp",
  "min",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "ts",
  "efg",
  "usage",
  "offRtg",
  "defRtg",
  "netRtg",
  "pie",
];
function ComparisonColumn({
  id,
  scope,
  onRemove,
  season,
  onSeason,
}: {
  id: number;
  scope: AnalysisScope;
  onRemove: () => void;
  season: string;
  onSeason: (season: string) => void;
}) {
  const player = players.find((item) => item.id === id);
  const bounds = (
    scope.seasonType === "Playoffs" ? playoffSeasons : seasons
  ).find((item) => item.id === season);
  const result = useAnalysis<StatsResult>("stats", {
    scope: {
      ...scope,
      season,
      start: bounds?.from || null,
      end: bounds?.to || null,
      team: "",
      position: "",
      minGames: 0,
      minMinutes: 0,
    },
    metrics: comparedMetrics,
    search: player?.name || String(id),
    sort: "pts",
    limit: 10,
    offset: 0,
  });
  const row = result.data?.rows.find((item) => item.player.id === id);
  return (
    <div className="research-comparison-column">
      <header>
        <strong>{player?.name}</strong>
        <button
          onClick={onRemove}
          aria-label={`Remove ${player?.name} from season comparison`}
        >
          Remove
        </button>
        <label>
          Season
          <select
            aria-label={`Comparison season for ${player?.name}`}
            value={season}
            onChange={(event) => onSeason(event.target.value)}
          >
            {seasons.map((item) => (
              <option key={item.id}>{item.id}</option>
            ))}
          </select>
        </label>
        <small>
          {bounds ? `${bounds.from} – ${bounds.to}` : "Not imported"} ·{" "}
          {scope.seasonType}
        </small>
      </header>
      {comparedMetrics.map((key) => (
        <div key={key} title={row?.missing[key] || metricById[key].definition}>
          {result.loading
            ? "…"
            : metricFormat(row?.values[key], metricById[key])}
        </div>
      ))}
      {result.error && (
        <p role="alert">
          {result.error}
          <button onClick={result.retry}>Retry</button>
        </p>
      )}
      {!result.loading && !result.error && !row && (
        <p>No appearances for this season and split.</p>
      )}
    </div>
  );
}
export function ResearchComparison({
  ids,
  onRemove,
  scope,
  selectedSeasons,
  onSeason,
}: {
  ids: number[];
  onRemove: (id: number) => void;
  scope: AnalysisScope;
  selectedSeasons: Record<string, string>;
  onSeason: (id: number, season: string) => void;
}) {
  return (
    <section className="panel research-panel">
      <h2>Different seasons. Same questions.</h2>
      <p>
        Add up to five players using the compare buttons in Statistics. Each
        column uses its selected full season, the shared split and stat basis.
        Team and eligibility filters are cleared for each selected player.
      </p>
      {ids.length ? (
        <div
          className="research-comparison-scroll"
          role="region"
          tabIndex={0}
          aria-label="Player season comparison"
        >
          <div className="research-comparison-labels">
            <header>Metric</header>
            {comparedMetrics.map((key) => (
              <div key={key}>{metricById[key].short}</div>
            ))}
          </div>
          {ids.map((id) => (
            <ComparisonColumn
              key={id}
              id={id}
              scope={scope}
              season={selectedSeasons[id] || scope.season}
              onSeason={(season) => onSeason(id, season)}
              onRemove={() => onRemove(id)}
            />
          ))}
        </div>
      ) : (
        <div className="research-empty">
          <h3>Start with a player</h3>
          <p>Open Statistics and select Compare beside a player’s name.</p>
        </div>
      )}
    </section>
  );
}
