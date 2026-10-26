"use client";
import { useState } from "react";
import { ArrowDownToLine, Check, Plus, X } from "lucide-react";
import {
  columnPresets,
  downloadFile,
  metricById,
  metricCatalog,
  metricFormat,
  type StatsRequest,
  type StatsResult,
} from "@/lib/advanced";
import { PlayerAvatar } from "./player-avatar";

export function StatsWorkbench({
  data,
  request,
  columns,
  setColumns,
  filters,
  setFilters,
  page,
  setPage,
  sort,
  ascending,
  onSort,
  onPlayer,
  selected,
  onCompare,
}: {
  data: StatsResult | null;
  request: StatsRequest;
  columns: string[];
  setColumns: (cols: string[]) => void;
  filters: StatsRequest["filters"];
  setFilters: (filters: StatsRequest["filters"]) => void;
  page: number;
  setPage: (page: number) => void;
  sort: string;
  ascending: boolean;
  onSort: (key: string) => void;
  onPlayer: (id: number) => void;
  selected: number[];
  onCompare: (id: number) => void;
}) {
  const [metricSearch, setMetricSearch] = useState("");
  const [heatmap, setHeatmap] = useState(true);
  const [error, setError] = useState("");
  const [filterMetric, setFilterMetric] = useState("pts");
  const [filterOp, setFilterOp] = useState<"gte" | "lte">("gte");
  const [filterValue, setFilterValue] = useState("20");
  async function exportCSV() {
    setError("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok)
        throw new Error(
          "Export failed. Retry when the analytics API is available.",
        );
      downloadFile(
        await response.blob(),
        `ballknowledge-${request.scope.season}-stats.csv`,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Export failed");
    }
  }
  const matches = metricCatalog.filter((metric) =>
    `${metric.label} ${metric.short} ${metric.group}`
      .toLowerCase()
      .includes(metricSearch.toLowerCase()),
  );
  return (
    <div className="panel research-panel">
      <div className="workbench-heading">
        <div>
          <h2>Build your view</h2>
          <p>Choose a preset, add metrics, then narrow the sample.</p>
        </div>
        <button className="button" disabled={!data} onClick={exportCSV}>
          <ArrowDownToLine size={15} />
          Export these stats
        </button>
      </div>
      <div className="workbench-controls">
        <label>
          Columns
          <select
            aria-label="Column preset"
            value=""
            onChange={(event) => {
              if (columnPresets[event.target.value])
                setColumns(columnPresets[event.target.value]);
            }}
          >
            <option value="">Choose preset…</option>
            {Object.keys(columnPresets).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <details className="column-picker">
          <summary>Customize {columns.length} columns</summary>
          <div className="column-picker-body">
            <label>
              Find a metric
              <input
                aria-label="Find a metric"
                value={metricSearch}
                onChange={(event) => setMetricSearch(event.target.value)}
                placeholder="Shooting, touches, impact…"
              />
            </label>
            <p>{matches.length} definitions · select up to 60</p>
            <div className="metric-options">
              {matches.map((metric) => (
                <label key={metric.id}>
                  <input
                    type="checkbox"
                    checked={columns.includes(metric.id)}
                    disabled={
                      !columns.includes(metric.id) && columns.length >= 60
                    }
                    onChange={() =>
                      setColumns(
                        columns.includes(metric.id)
                          ? columns.length > 1
                            ? columns.filter((key) => key !== metric.id)
                            : columns
                          : [...columns, metric.id],
                      )
                    }
                  />
                  <span>
                    <strong>{metric.label}</strong>
                    <small>
                      {metric.group} ·{" "}
                      {metric.source === "unavailable"
                        ? "Unavailable model"
                        : metric.source}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </details>
        <label className="checkbox-control">
          <input
            type="checkbox"
            checked={heatmap}
            onChange={(event) => setHeatmap(event.target.checked)}
          />
          Percentile shading
        </label>
      </div>
      <form
        className="metric-filter-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            filters.length < 10 &&
            filterValue !== "" &&
            Number.isFinite(Number(filterValue))
          )
            setFilters([
              ...filters,
              {
                metric: filterMetric,
                op: filterOp,
                value: Number(filterValue),
              },
            ]);
        }}
      >
        <label>
          Metric filter
          <select
            aria-label="Filter metric"
            value={filterMetric}
            onChange={(event) => setFilterMetric(event.target.value)}
          >
            {metricCatalog.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rule
          <select
            aria-label="Filter comparison"
            value={filterOp}
            onChange={(event) =>
              setFilterOp(event.target.value as "gte" | "lte")
            }
          >
            <option value="gte">At least</option>
            <option value="lte">At most</option>
          </select>
        </label>
        <label>
          Value
          <input
            aria-label="Filter value"
            type="number"
            step="any"
            required
            value={filterValue}
            onChange={(event) => setFilterValue(event.target.value)}
          />
        </label>
        <button className="button" disabled={filters.length >= 10}>
          <Plus size={14} />
          Add filter
        </button>
      </form>
      {filters.length > 0 && (
        <div className="research-filter-chips">
          {filters.map((filter, index) => (
            <button
              key={index}
              onClick={() =>
                setFilters(filters.filter((_, item) => item !== index))
              }
            >
              {metricById[filter.metric].short}{" "}
              {filter.op === "gte" ? "≥" : "≤"} {filter.value}
              <X size={12} />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button onClick={() => setFilters([])}>Clear all</button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="research-table-summary">
            <strong>{data.total.toLocaleString()} matching players</strong>
            <span>
              {data.cohortSize} players in percentile cohort ·{" "}
              {request.scope.mode.replaceAll("_", " ")}
            </span>
          </div>
          <div
            className="research-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable advanced player statistics"
          >
            <table
              className="research-table"
              aria-label="Advanced player statistics"
            >
              <thead>
                <tr>
                  <th scope="col">Compare</th>
                  <th scope="col" className="identity-column">
                    Player
                  </th>
                  {columns.map((key) => (
                    <th
                      key={key}
                      scope="col"
                      aria-sort={
                        sort === key
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        onClick={() => onSort(key)}
                        title={metricById[key].definition}
                      >
                        {metricById[key].short}
                        {sort === key && (ascending ? " ↑" : " ↓")}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.player.id}>
                    <td>
                      <button
                        className="research-compare-button"
                        aria-label={`${selected.includes(row.player.id) ? "Remove" : "Compare"} ${row.player.name}`}
                        aria-pressed={selected.includes(row.player.id)}
                        disabled={
                          selected.length >= 5 &&
                          !selected.includes(row.player.id)
                        }
                        onClick={() => onCompare(row.player.id)}
                      >
                        {selected.includes(row.player.id) ? (
                          <Check size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    </td>
                    <th scope="row" className="identity-column">
                      <button
                        className="research-player"
                        onClick={() => onPlayer(row.player.id)}
                      >
                        <PlayerAvatar player={row.player} />
                        <span>
                          {row.player.name}
                          <small>
                            {row.player.team} ·{" "}
                            {row.player.position || "Position unavailable"} ·{" "}
                            {row.games} GP
                          </small>
                        </span>
                      </button>
                    </th>
                    {columns.map((key) => {
                      const rank = row.percentiles[key];
                      return (
                        <td
                          key={key}
                          title={
                            row.missing[key] ||
                            `${metricById[key].definition} · Percentile ${rank?.toFixed(0) ?? "unavailable"}`
                          }
                          style={
                            heatmap && rank != null
                              ? {
                                  backgroundColor:
                                    rank >= 50
                                      ? `rgba(71,107,76,${0.03 + (rank - 50) / 250})`
                                      : `rgba(196,72,38,${0.03 + (50 - rank) / 350})`,
                                }
                              : undefined
                          }
                        >
                          <span>
                            {metricFormat(row.values[key], metricById[key])}
                          </span>
                          {row.values[key] == null && (
                            <small className="missing-label">Unavailable</small>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rows.length === 0 && (
              <div className="research-empty">
                <h3>No players meet this sample</h3>
                <p>
                  Reduce eligibility or clear metric filters to broaden the
                  view.
                </p>
              </div>
            )}
          </div>
          <div className="table-pagination">
            <span>
              Showing {data.total ? page * 50 + 1 : 0}–
              {Math.min((page + 1) * 50, data.total)} of {data.total}
            </span>
            <div>
              <button
                className="button"
                aria-label="Previous advanced stats page"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="button"
                aria-label="Next advanced stats page"
                disabled={(page + 1) * 50 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
          <details className="research-methodology">
            <summary>Definitions, percentile cohort & data coverage</summary>
            <p>{data.meta.cohort}</p>
            <p>
              Box scores retrieved{" "}
              {new Date(data.meta.dataAsOf).toLocaleString()}. CSV export
              includes the full filtered population. Unavailable cells are never
              zero-filled.
            </p>
            {Object.entries(data.meta.providers).map(([source, provider]) => (
              <p key={source}>
                <strong>{source}</strong> ·{" "}
                {provider.reason ||
                  `Retrieved ${provider.fetchedAt ? new Date(provider.fetchedAt).toLocaleString() : "time unavailable"}`}
              </p>
            ))}
            <dl>
              {columns.map((key) => (
                <div key={key}>
                  <dt>{metricById[key].label}</dt>
                  <dd>{metricById[key].definition}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
