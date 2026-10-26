"use client";
import { useRef, useState } from "react";
import {
  downloadFile,
  metricCatalog,
  metricById,
  metricFormat,
  type StatsResult,
} from "@/lib/advanced";
import { useSmallScreen } from "./use-small-screen";

export function ResearchScatter({
  data,
  x,
  y,
  onX,
  onY,
  onPlayer,
}: {
  data: StatsResult;
  x: string;
  y: string;
  onX: (id: string) => void;
  onY: (id: string) => void;
  onPlayer: (id: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const compact = useSmallScreen();
  const width = compact ? 420 : 800;
  const height = compact ? 380 : 440;
  const left = compact ? 82 : 76;
  const right = compact ? width - 30 : 736;
  const top = compact ? 30 : 56;
  const bottom = compact ? height - 100 : 342;
  const [hover, setHover] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const rows = data.rows.filter(
    (row) => row.values[x] != null && row.values[y] != null,
  );
  const xs = rows.map((row) => row.values[x]!);
  const ys = rows.map((row) => row.values[y]!);
  const bounds = (values: number[]) => {
    const low = Math.min(...values, 0),
      high = Math.max(...values, 1);
    return [low, high === low ? high + 1 : high];
  };
  const [xmin, xmax] = bounds(xs),
    [ymin, ymax] = bounds(ys);
  const px = (value: number) =>
    left + ((value - xmin) / (xmax - xmin)) * (right - left);
  const py = (value: number) =>
    bottom - ((value - ymin) / (ymax - ymin)) * (bottom - top);
  const tick = (value: number) =>
    compact
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value)
      : value.toFixed(1);
  async function exportChart() {
    if (!svg.current) return;
    setExportError("");
    const serialized = new XMLSerializer().serializeToString(svg.current);
    const url = URL.createObjectURL(
      new Blob([serialized], { type: "image/svg+xml" }),
    );
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = Math.round((1600 * height) / width);
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadFile(blob, "ballknowledge-scatter.png");
        else setExportError("Chart export failed. Try again.");
      });
    } catch {
      setExportError("Chart export failed. Try again.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <section className="panel research-panel">
      <div className="workbench-heading">
        <div>
          <h2>Find the outliers</h2>
          <p>
            {rows.length} players with both metrics ·{" "}
            {data.total > 500
              ? "first 500 matches; narrow filters for a complete plot"
              : "full matching sample"}
          </p>
        </div>
        <button
          className="button"
          onClick={exportChart}
          disabled={!rows.length}
        >
          Export PNG
        </button>
      </div>
      <div className="workbench-controls">
        {[
          ["Horizontal axis", x, onX],
          ["Vertical axis", y, onY],
        ].map(([label, value, change]) => (
          <label key={label as string}>
            {label as string}
            <select
              aria-label={label as string}
              value={value as string}
              onChange={(event) =>
                (change as (id: string) => void)(event.target.value)
              }
            >
              {metricCatalog.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      {rows.length > 0 ? (
        <>
          <div className="research-chart">
            <svg
              ref={svg}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${width} ${height}`}
              aria-label={`${metricById[x].label} versus ${metricById[y].label}`}
            >
              <rect width={width} height={height} fill="#fff" />
              {Array.from({ length: 5 }, (_, i) => {
                const xv = xmin + ((xmax - xmin) * i) / 4,
                  yv = ymin + ((ymax - ymin) * i) / 4;
                return (
                  <g
                    key={i}
                    fontFamily="Arial,sans-serif"
                    fontSize={compact ? 18 : 13}
                    fill="#47564b"
                  >
                    <line
                      x1={left}
                      x2={right}
                      y1={py(yv)}
                      y2={py(yv)}
                      stroke="#e5e8df"
                    />
                    <text x={left - 12} y={py(yv) + 4} textAnchor="end">
                      {tick(yv)}
                    </text>
                    <text x={px(xv)} y={bottom + 27} textAnchor="middle">
                      {tick(xv)}
                    </text>
                  </g>
                );
              })}
              {rows.map((row) => (
                <g
                  key={row.player.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open ${row.player.name}: ${metricById[x].short} ${metricFormat(row.values[x], metricById[x])}, ${metricById[y].short} ${metricFormat(row.values[y], metricById[y])}`}
                  onFocus={() => setHover(row.player.id)}
                  onMouseEnter={() => setHover(row.player.id)}
                  onClick={() => onPlayer(row.player.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onPlayer(row.player.id);
                    }
                  }}
                >
                  <circle
                    cx={px(row.values[x]!)}
                    cy={py(row.values[y]!)}
                    r={hover === row.player.id ? 7 : 4}
                    fill={hover === row.player.id ? "#c44826" : "#476b4c"}
                    fillOpacity=".75"
                  />
                  <title>{row.player.name}</title>
                </g>
              ))}
              <text
                x={(left + right) / 2}
                y={height - 55}
                textAnchor="middle"
                fill="#24362e"
                fontSize={compact ? 20 : 16}
                fontFamily="Arial,sans-serif"
              >
                {compact ? metricById[x].short : metricById[x].label}
              </text>
              <text
                x={compact ? 16 : 20}
                y={(top + bottom) / 2}
                textAnchor="middle"
                transform={`rotate(-90 ${compact ? 16 : 20} ${(top + bottom) / 2})`}
                fill="#24362e"
                fontSize={compact ? 20 : 16}
                fontFamily="Arial,sans-serif"
              >
                {compact ? metricById[y].short : metricById[y].label}
              </text>
              <text
                x={compact ? 16 : left}
                y={height - 26}
                fill="#626c60"
                fontSize={compact ? 13 : 11}
                fontFamily="Arial,sans-serif"
              >
                Ballknowledge · NBA · {data.meta.scope.season} ·{" "}
                {data.meta.scope.mode}
              </text>
              <text
                x={compact ? 16 : left}
                y={height - 8}
                fill="#626c60"
                fontSize={compact ? 12 : 10}
                fontFamily="Arial,sans-serif"
              >
                {data.meta.scope.start || "Season start"} to{" "}
                {data.meta.scope.end || "latest imported game"}
              </text>
            </svg>
          </div>
          <p className="research-chart-caption" aria-live="polite">
            {hover
              ? rows.find((row) => row.player.id === hover)?.player.name
              : "Focus or hover a point to identify a player. Select it to open their profile."}
          </p>
        </>
      ) : (
        <div className="research-empty">
          <h3>No paired observations</h3>
          <p>
            Choose metrics with matching source coverage, or broaden the sample.
            Unavailable metrics are not plotted.
          </p>
        </div>
      )}
    </section>
  );
}
