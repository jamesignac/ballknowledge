"use client";

import { useState } from "react";
import { ArrowUpRight, Crosshair } from "lucide-react";
import {
  format,
  metrics,
  type Metric,
  type PlayerStats,
} from "@/lib/analytics";
import { teams } from "@/lib/data";
import { useSmallScreen } from "./use-small-screen";

export function Scatter({
  rows,
  x,
  y,
  onAxis,
  onPlayer,
  selected,
  full = false,
}: {
  rows: PlayerStats[];
  x: Metric;
  y: Metric;
  onAxis: (key: "x" | "y", value: Metric) => void;
  onPlayer: (id: number) => void;
  selected: number[];
  full?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const compact = useSmallScreen();
  const chart = compact
    ? {
        width: 410,
        height: 300,
        left: 58,
        right: 385,
        top: 35,
        bottom: 245,
        ticks: 3,
      }
    : {
        width: 790,
        height: 350,
        left: 66,
        right: 726,
        top: 50,
        bottom: 295,
        ticks: 4,
      };
  const points = rows.filter(
    (row) => Number.isFinite(row[x]) && Number.isFinite(row[y]),
  );
  const valuesX = points.map((row) => row[x]);
  const valuesY = points.map((row) => row[y]);
  const extent = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 10;
    return [Math.max(0, min - spread * 0.15), max + spread * 0.17];
  };
  const [xmin, xmax] = points.length ? extent(valuesX) : [0, 40];
  const [ymin, ymax] = points.length ? extent(valuesY) : [0, 100];
  const px = (v: number) =>
    chart.left + ((v - xmin) / (xmax - xmin)) * (chart.right - chart.left);
  const py = (v: number) =>
    chart.bottom - ((v - ymin) / (ymax - ymin)) * (chart.bottom - chart.top);
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const active = points.find((row) => row.id === hovered);
  const labelIds = [...rows]
    .sort((a, b) => b.pts - a.pts)
    .slice(0, compact ? 0 : full ? 7 : 4)
    .map((row) => row.id);
  return (
    <section
      className={`panel scatter-panel ${full ? "full-scatter" : ""} ${compact ? "compact-chart" : ""}`}
      aria-label="Player scatter plot"
    >
      <div className="panel-heading">
        <div>
          <h2>
            Find the outliers
            <span className="orange-dot" />
          </h2>
          <p>Different games. Same playing field.</p>
        </div>
        <Crosshair size={20} className="muted-icon" />
      </div>
      <div className="axis-controls">
        {(["x", "y"] as const).map((axis) => (
          <label key={axis}>
            <span>{axis.toUpperCase()} axis</span>
            <select
              aria-label={`${axis.toUpperCase()} axis metric`}
              value={axis === "x" ? x : y}
              onChange={(event) => onAxis(axis, event.target.value as Metric)}
            >
              {Object.entries(metrics).map(([key, metric]) => (
                <option key={key} value={key}>
                  {metric.label}
                  {metric.unit ? " %" : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="scatter-wrap">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          role="group"
          aria-label={`${metrics[y].label} versus ${metrics[x].label} for ${points.length} players. Use the player table for exact values.`}
        >
          {Array.from({ length: chart.ticks + 1 }, (_, step) => (
            <g key={step} className="chart-grid">
              <line
                x1={chart.left}
                x2={chart.right}
                y1={
                  chart.top + (step * (chart.bottom - chart.top)) / chart.ticks
                }
                y2={
                  chart.top + (step * (chart.bottom - chart.top)) / chart.ticks
                }
              />
              <text
                x={chart.left - 10}
                y={
                  chart.top +
                  4 +
                  (step * (chart.bottom - chart.top)) / chart.ticks
                }
                textAnchor="end"
              >
                {(ymax - ((ymax - ymin) * step) / chart.ticks).toFixed(0)}
                {metrics[y].unit}
              </text>
              <text
                x={
                  chart.left + (step * (chart.right - chart.left)) / chart.ticks
                }
                y={chart.bottom + 23}
                textAnchor="middle"
              >
                {(xmin + ((xmax - xmin) * step) / chart.ticks).toFixed(0)}
              </text>
            </g>
          ))}
          <text
            className="axis-title"
            x={(chart.left + chart.right) / 2}
            y={chart.height - 5}
            textAnchor="middle"
          >
            {metrics[x].label}
            {metrics[x].unit ? " (%)" : ""} →
          </text>
          <text
            className="axis-title"
            transform={`translate(15,${(chart.top + chart.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {metrics[y].label}
            {metrics[y].unit ? " (%)" : ""} →
          </text>
          {points.length > 0 && (
            <>
              <line
                className="average-line"
                x1={px(average(valuesX))}
                x2={px(average(valuesX))}
                y1={chart.top}
                y2={chart.bottom}
              />
              <line
                className="average-line"
                x1={chart.left}
                x2={chart.right}
                y1={py(average(valuesY))}
                y2={py(average(valuesY))}
              />
            </>
          )}
          {points.map((row) => (
            <g key={row.id}>
              <circle
                className={`scatter-point ${selected.includes(row.id) ? "selected" : ""}`}
                cx={px(row[x])}
                cy={py(row[y])}
                r={selected.includes(row.id) ? 7.5 : 5.5}
                fill={teams.find((team) => team.abbr === row.team)?.color}
                role="button"
                tabIndex={0}
                aria-label={`Open ${row.name}, ${metrics[x].label} ${format(row[x])}, ${metrics[y].label} ${format(row[y])}`}
                onMouseEnter={() => setHovered(row.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(row.id)}
                onBlur={() => setHovered(null)}
                onClick={() => onPlayer(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPlayer(row.id);
                  }
                }}
              >
                <title>{`${row.name}: ${format(row[x])} ${metrics[x].short}, ${format(row[y])} ${metrics[y].short}`}</title>
              </circle>
              {labelIds.includes(row.id) && (
                <text
                  className="point-label"
                  x={px(row[x]) + 11}
                  y={py(row[y]) - 9}
                >
                  {row.name.split(" ").slice(-1)[0]}
                </text>
              )}
            </g>
          ))}
        </svg>
        {active && (
          <div className="chart-tooltip" role="status">
            <strong>{active.name}</strong>
            <span>
              {format(active[x])}
              {metrics[x].unit} {metrics[x].short} · {format(active[y])}
              {metrics[y].unit} {metrics[y].short}
            </span>
          </div>
        )}
        {!points.length && (
          <div className="chart-empty">
            No players match this scope. Adjust your filters.
          </div>
        )}
      </div>
      <div className="chart-foot">
        <span>
          <i className="legend-dot" />
          Color by team <span className="legend-line" />
          Sample average
        </span>
        <span>
          {points.length} players <ArrowUpRight size={13} />
        </span>
      </div>
    </section>
  );
}
