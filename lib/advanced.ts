import catalog from "@/packages/analytics-contracts/metrics.json";
import type { Scope } from "./analytics";
import type { Player } from "./data";

export interface MetricDefinition {
  id: string;
  label: string;
  short: string;
  group: string;
  kind: string;
  source: string;
  definition: string;
  unit: string;
  higherIsBetter: boolean;
}
export const metricCatalog: MetricDefinition[] = catalog.metrics;
export const metricById = Object.fromEntries(
  metricCatalog.map((metric) => [metric.id, metric]),
);
export const columnPresets: Record<string, string[]> = catalog.presets;
export interface AnalysisScope {
  season: string;
  seasonType: "Regular Season" | "Playoffs";
  start: string | null;
  end: string | null;
  team: string;
  position: string;
  split: string;
  minGames: number;
  minMinutes: number;
  mode: "per_game" | "per36" | "per75" | "per100" | "totals";
}
export function isAnalysisScope(value: unknown): value is AnalysisScope {
  if (!value || typeof value !== "object") return false;
  const scope = value as Record<string, unknown>;
  const date = (item: unknown) =>
    item === null ||
    (typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item));
  return (
    typeof scope.season === "string" &&
    /^20\d{2}-\d{2}$/.test(scope.season) &&
    ["Regular Season", "Playoffs"].includes(String(scope.seasonType)) &&
    ["per_game", "per36", "per75", "per100", "totals"].includes(
      String(scope.mode),
    ) &&
    [
      "all",
      "home",
      "away",
      "wins",
      "losses",
      "last5",
      "last10",
      "last20",
    ].includes(String(scope.split)) &&
    date(scope.start) &&
    date(scope.end) &&
    typeof scope.team === "string" &&
    /^([A-Z]{3})?$/.test(scope.team) &&
    typeof scope.position === "string" &&
    /^([GFC])?$/.test(scope.position) &&
    typeof scope.minGames === "number" &&
    Number.isInteger(scope.minGames) &&
    scope.minGames >= 0 &&
    scope.minGames <= 100 &&
    typeof scope.minMinutes === "number" &&
    Number.isFinite(scope.minMinutes) &&
    scope.minMinutes >= 0 &&
    scope.minMinutes <= 6000
  );
}
export function analysisScope(scope: Scope): AnalysisScope {
  return {
    season: scope.season,
    seasonType: "Regular Season",
    start: scope.from || null,
    end: scope.to || null,
    team: scope.team === "ALL" ? "" : scope.team,
    position: scope.position === "ALL" ? "" : scope.position,
    split: "all",
    minGames: scope.minGames,
    minMinutes: 0,
    mode: scope.perMode,
  };
}
export interface AnalysisRow {
  rowId?: string;
  season?: string;
  player: Player;
  games: number;
  minutes: number;
  teamIds: string[];
  from: string;
  to: string;
  values: Record<string, number | null>;
  missing: Record<string, string>;
  percentiles: Record<string, number | null>;
}
export interface AnalysisMeta {
  scope: AnalysisScope;
  dataAsOf: string;
  source: { label: string; urls: string[] };
  cohort: string;
  providers: Record<
    string,
    { fetchedAt?: string; reason?: string; cache?: string }
  >;
}
export interface StatsResult {
  rows: AnalysisRow[];
  total: number;
  cohortSize: number;
  definitions: Record<string, MetricDefinition>;
  meta: AnalysisMeta;
}
export interface StatsRequest {
  scope: AnalysisScope;
  metrics: string[];
  search: string;
  sort: string;
  ascending: boolean;
  offset: number;
  limit: number;
  filters: { metric: string; op: "gte" | "lte"; value: number }[];
}
export async function apiRequest<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : `Analytics request failed (${response.status}). Check that the API is running and retry.`,
    );
  }
  return response.json();
}
export function metricFormat(
  value: number | null | undefined,
  metric: MetricDefinition,
) {
  if (value == null) return "—";
  return (
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits:
        metric.id === "gp" ? 0 : metric.kind === "rate" ? 2 : 1,
    }).format(value) + (metric.unit === "%" ? "%" : "")
  );
}
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
