"use client";
import { useState } from "react";
import { teams, seasons } from "@/lib/data";
import type { AnalysisScope } from "@/lib/advanced";
import { useAnalysis } from "./use-analysis";
const metrics = [
  "GP",
  "OFF_RATING",
  "DEF_RATING",
  "NET_RATING",
  "EFG_PCT",
  "TS_PCT",
  "OREB_PCT",
  "DREB_PCT",
  "TM_TOV_PCT",
  "PACE",
];
function TeamColumn({
  initial,
  scope,
}: {
  initial: string;
  scope: AnalysisScope;
}) {
  const [team, setTeam] = useState(initial),
    [season, setSeason] = useState(scope.season);
  const bounds = seasons.find((item) => item.id === season)!;
  const result = useAnalysis<{
    rows: Record<string, string | number | null>[];
    reason?: string;
  }>("explore/teamAdvanced", {
    ...scope,
    season,
    team,
    start: bounds.from,
    end: bounds.to,
    minGames: 0,
    minMinutes: 0,
    position: "",
  });
  const row = result.data?.rows[0];
  return (
    <div className="research-comparison-column">
      <header>
        <label>
          Team
          <select
            aria-label={`Team comparison ${initial}`}
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          >
            {teams.map((item) => (
              <option key={item.abbr} value={item.abbr}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select
            aria-label={`Team comparison season ${initial}`}
            value={season}
            onChange={(event) => setSeason(event.target.value)}
          >
            {seasons.map((item) => (
              <option key={item.id}>{item.id}</option>
            ))}
          </select>
        </label>
      </header>
      {metrics.map((key) => {
        const value = row?.[key];
        return (
          <div key={key}>
            {result.loading
              ? "…"
              : typeof value === "number"
                ? key.includes("PCT")
                  ? `${(value * 100).toFixed(1)}%`
                  : value.toFixed(key === "GP" ? 0 : 1)
                : "—"}
          </div>
        );
      })}
      {result.error && <p role="alert">{result.error}</p>}
      {result.data?.reason && <p>{result.data.reason}</p>}
    </div>
  );
}
export function TeamComparison({ scope }: { scope: AnalysisScope }) {
  const [count, setCount] = useState(2);
  return (
    <section className="panel research-panel">
      <div className="workbench-heading">
        <div>
          <h2>Put teams side by side</h2>
          <p>
            Full regular seasons and the shared home/away, outcome or last-N
            split. Ratings remain points per 100 possessions; no per-game
            conversion is applied to rates.
          </p>
        </div>
        <label>
          Teams
          <select
            aria-label="Number of comparison teams"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          >
            {[2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="research-comparison-scroll"
        tabIndex={0}
        role="region"
        aria-label="Team season comparison"
      >
        <div className="research-comparison-labels">
          <header>Metric</header>
          {metrics.map((key) => (
            <div key={key}>{key.replaceAll("_", " ")}</div>
          ))}
        </div>
        {["BOS", "DEN", "OKC", "NYK", "LAL"].slice(0, count).map((team) => (
          <TeamColumn
            key={team}
            initial={team}
            scope={{ ...scope, seasonType: "Regular Season" }}
          />
        ))}
      </div>
    </section>
  );
}
