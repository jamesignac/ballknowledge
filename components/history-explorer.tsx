"use client";
import { useState } from "react";
import { seasons } from "@/lib/data";
import {
  metricById,
  metricFormat,
  type AnalysisScope,
  type StatsResult,
} from "@/lib/advanced";
import { useAnalysis } from "./use-analysis";
const columns = [
  "gp",
  "min",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fg",
  "three",
  "ts",
  "rts",
];
export function HistoryExplorer({ scope }: { scope: AnalysisScope }) {
  const [selected, setSelected] = useState(seasons.map((item) => item.id));
  const [pooled, setPooled] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("pts");
  const [page, setPage] = useState(0);
  const result = useAnalysis<StatsResult>(
    "history",
    {
      scope: { ...scope, seasonType: "Regular Season" },
      seasons: selected,
      pooled,
      search,
      sort,
      metrics: columns,
      limit: 50,
      offset: page * 50,
    },
    selected.length > 0,
  );
  return (
    <section className="panel research-panel">
      <h2>Follow a player across seasons</h2>
      <p>
        Full imported regular seasons. A pooled row sums box-score components
        before recomputing ratios; provider ratings are never averaged into a
        career metric. Four seasons are imported; other history remains
        unavailable until backfilled.
      </p>
      <div className="workbench-controls">
        {seasons.map((item) => (
          <label className="checkbox-control" key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => {
                setSelected(
                  selected.includes(item.id)
                    ? selected.filter((id) => id !== item.id)
                    : [...selected, item.id],
                );
                setPage(0);
              }}
            />
            {item.id}
          </label>
        ))}
        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={pooled}
            onChange={(event) => {
              setPooled(event.target.checked);
              setPage(0);
            }}
          />
          Pool selected years
        </label>
        <label>
          Find player
          <input
            aria-label="Search historical players"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      {!selected.length ? (
        <p>Select at least one season.</p>
      ) : result.loading ? (
        <p role="status">Loading historical samples…</p>
      ) : result.error ? (
        <div role="alert">
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Retry history
          </button>
        </div>
      ) : (
        result.data && (
          <>
            <p>
              {result.data.total} {pooled ? "player" : "player-season"} rows ·{" "}
              {scope.mode.replaceAll("_", " ")}
            </p>
            <div
              className="research-table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Historical player statistics"
            >
              <table className="research-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Season</th>
                    {columns.map((key) => (
                      <th key={key}>
                        <button
                          onClick={() => {
                            setSort(key);
                            setPage(0);
                          }}
                        >
                          {metricById[key].short}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((row) => (
                    <tr key={row.rowId}>
                      <th scope="row">
                        <a
                          href={`/players/${row.player.id}?season=${row.season === "Pooled" ? scope.season : row.season}`}
                        >
                          {row.player.name}
                        </a>
                      </th>
                      <td>{row.season}</td>
                      {columns.map((key) => (
                        <td key={key}>
                          {metricFormat(row.values[key], metricById[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <span>
                {page * 50 + 1}–{Math.min((page + 1) * 50, result.data.total)}{" "}
                of {result.data.total}
              </span>
              <div>
                <button
                  className="button"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous history page
                </button>
                <button
                  className="button"
                  disabled={(page + 1) * 50 >= result.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next history page
                </button>
              </div>
            </div>
          </>
        )
      )}
    </section>
  );
}
