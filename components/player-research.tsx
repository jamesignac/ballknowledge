"use client";
import { useState } from "react";
import {
  analysisScope,
  metricById,
  metricFormat,
  type AnalysisRow,
} from "@/lib/advanced";
import type { Scope } from "@/lib/analytics";
import { useAnalysis } from "./use-analysis";

interface PlayerDashboard {
  splits: Record<string, AnalysisRow | null>;
}
interface Career {
  rows: Record<string, string | number | null>[];
  tables?: { name: string; rows: Record<string, string | number | null>[] }[];
  reason?: string;
}
export function PlayerResearch({ id, scope }: { id: number; scope: Scope }) {
  const [tab, setTab] = useState<"splits" | "career">("splits");
  const result = useAnalysis<PlayerDashboard>(
    `players/${id}`,
    analysisScope(scope),
    tab === "splits",
  );
  const career = useAnalysis<Career>(
    `explore/career?player=${id}`,
    analysisScope(scope),
    tab === "career",
  );
  const current = tab === "splits" ? result : career;
  const careerRows =
    career.data?.tables?.find(
      (table) => table.name === "SeasonTotalsRegularSeason",
    )?.rows ||
    career.data?.rows ||
    [];
  return (
    <section className="player-research">
      <h3>Go deeper</h3>
      <div className="research-tabs" aria-label="Player research views">
        <button
          aria-pressed={tab === "splits"}
          className={tab === "splits" ? "active" : ""}
          onClick={() => setTab("splits")}
        >
          Performance splits
        </button>
        <button
          aria-pressed={tab === "career"}
          className={tab === "career" ? "active" : ""}
          onClick={() => setTab("career")}
        >
          Career totals
        </button>
      </div>
      {current.loading && <p role="status">Loading player research…</p>}
      {current.error && (
        <div role="alert">
          <p>{current.error}</p>
          <button className="button" onClick={current.retry}>
            Retry player research
          </button>
        </div>
      )}
      {tab === "splits" && result.data && (
        <>
          <p className="research-footnote">
            Splits are computed within this date and team window. Last-N counts
            each player’s recorded appearances.
          </p>
          <div className="research-table-scroll">
            <table className="research-table">
              <thead>
                <tr>
                  <th>Split</th>
                  {["gp", "min", "pts", "reb", "ast", "ts", "efg"].map(
                    (key) => (
                      <th key={key}>{metricById[key].short}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.data.splits).map(([split, row]) => (
                  <tr key={split}>
                    <th scope="row">
                      {split === "all"
                        ? "All selected games"
                        : split.replace("last", "Last ")}
                    </th>
                    {["gp", "min", "pts", "reb", "ast", "ts", "efg"].map(
                      (key) => (
                        <td key={key}>
                          {metricFormat(row?.values[key], metricById[key])}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "career" && career.data && (
        <>
          <p className="research-footnote">
            NBA career regular-season totals; this view intentionally covers all
            career seasons and ignores the date window. Traded players can have
            team stints plus a TOT row; do not sum both.
          </p>
          {career.data.reason ? (
            <p>{career.data.reason}</p>
          ) : (
            <div className="research-table-scroll">
              <table className="research-table">
                <thead>
                  <tr>
                    {[
                      "SEASON_ID",
                      "TEAM_ABBREVIATION",
                      "GP",
                      "MIN",
                      "PTS",
                      "REB",
                      "AST",
                      "FGM",
                      "FGA",
                      "FG3M",
                      "FG3A",
                    ].map((key) => (
                      <th key={key}>{key.replaceAll("_", " ")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {careerRows.map((row, index) => (
                    <tr key={index}>
                      {[
                        "SEASON_ID",
                        "TEAM_ABBREVIATION",
                        "GP",
                        "MIN",
                        "PTS",
                        "REB",
                        "AST",
                        "FGM",
                        "FGA",
                        "FG3M",
                        "FG3A",
                      ].map((key) => (
                        <td key={key}>{row[key] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
