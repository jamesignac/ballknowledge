import {
  teams,
  seasons,
  latestSeason,
  type Player,
  type GameLog,
  type SeasonData,
  type SeasonMetadata,
} from "./data";

export const metrics = {
  pts: {
    label: "Points",
    short: "PTS",
    unit: "",
    definition:
      "Points scored. Derived from two-point makes, three-point makes, and free throws.",
  },
  reb: {
    label: "Rebounds",
    short: "REB",
    unit: "",
    definition: "Total offensive and defensive rebounds.",
  },
  ast: {
    label: "Assists",
    short: "AST",
    unit: "",
    definition: "Passes credited with directly creating a made basket.",
  },
  ts: {
    label: "True shooting",
    short: "TS%",
    unit: "%",
    definition: "100 × PTS / (2 × (FGA + 0.44 × FTA)). Recomputed from totals.",
  },
  fg: {
    label: "Field goal",
    short: "FG%",
    unit: "%",
    definition: "100 × field goals made / field goals attempted.",
  },
  three: {
    label: "Three-point",
    short: "3P%",
    unit: "%",
    definition:
      "100 × three-point field goals made / three-point attempts. Unavailable without attempts.",
  },
  stl: {
    label: "Steals",
    short: "STL",
    unit: "",
    definition: "Steals credited in the selected sample.",
  },
  blk: {
    label: "Blocks",
    short: "BLK",
    unit: "",
    definition: "Blocked shot attempts credited in the selected sample.",
  },
  min: {
    label: "Minutes",
    short: "MIN",
    unit: "",
    definition: "Minutes played. Shown per game except in totals mode.",
  },
} as const;
export type Metric = keyof typeof metrics;
export type PlayerStats = Player & {
  teamIds: string[];
  pts: number;
  reb: number;
  ast: number;
  fg: number;
  gp: number;
  min: number;
  ts: number;
  stl: number;
  blk: number;
  tov: number;
  three: number;
  logs: GameLog[];
};
export interface Scope {
  season: string;
  from: string;
  to: string;
  team: string;
  position: string;
  minGames: number;
  perMode: "per_game" | "per36" | "totals";
  search: string;
  x: Metric;
  y: Metric;
}
export const defaultScope: Scope = {
  season: latestSeason,
  from: seasons[0].from,
  to: seasons[0].to,
  team: "ALL",
  position: "ALL",
  minGames: 1,
  perMode: "per_game",
  search: "",
  x: "pts",
  y: "ts",
};
export const seasonBounds = (season: string) => {
  const entry = seasons.find((entry) => entry.id === season) || seasons[0];
  return { from: entry.from, to: entry.to };
};
const validDate = (value: string | null) =>
  !!value &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function parseScope(params: URLSearchParams): Scope {
  const season = seasons.some((entry) => entry.id === params.get("season"))
    ? params.get("season")!
    : defaultScope.season;
  const bounds = seasonBounds(season);
  let from = validDate(params.get("from")) ? params.get("from")! : bounds.from;
  let to = validDate(params.get("to")) ? params.get("to")! : bounds.to;
  if (from > to) [from, to] = [to, from];
  const min = params.get("minGames");
  const mode = params.get("perMode");
  return {
    season,
    from,
    to,
    team: teams.some((t) => t.abbr === params.get("team"))
      ? params.get("team")!
      : "ALL",
    position: ["PG", "SG", "SF", "PF", "G", "F", "C"].includes(
      params.get("position") || "",
    )
      ? params.get("position")!
      : "ALL",
    minGames:
      min !== null && /^\d+$/.test(min) && +min <= 82
        ? +min
        : defaultScope.minGames,
    perMode: mode === "totals" || mode === "per36" ? mode : "per_game",
    search: (params.get("search") || "").slice(0, 100),
    x: Object.hasOwn(metrics, params.get("x") || "")
      ? (params.get("x") as Metric)
      : "pts",
    y: Object.hasOwn(metrics, params.get("y") || "")
      ? (params.get("y") as Metric)
      : "ts",
  };
}
export function scopeParams(scope: Scope) {
  return new URLSearchParams(
    Object.entries(scope).map(([key, value]) => [key, String(value)]),
  );
}
export function aggregatePlayers(
  scope: Scope,
  data: SeasonData,
): PlayerStats[] {
  const logs = data.gameLogs.filter(
    (log) =>
      log.season === scope.season &&
      log.date >= scope.from &&
      log.date <= scope.to &&
      (scope.team === "ALL" || log.team === scope.team),
  );
  const grouped = new Map<number, GameLog[]>();
  for (const log of logs) {
    const group = grouped.get(log.playerId) || [];
    group.push(log);
    grouped.set(log.playerId, group);
  }
  return data.players
    .filter(
      (player) =>
        (scope.position === "ALL" ||
          (["G", "F", "C"].includes(scope.position)
            ? (player.position || "").split("-").includes(scope.position)
            : player.position === scope.position)) &&
        normalize(player.name).includes(normalize(scope.search)),
    )
    .flatMap((player) => {
      const sample = grouped.get(player.id) || [];
      if (!sample.length || sample.length < scope.minGames) return [];
      const sum = (key: keyof GameLog) =>
        sample.reduce((total, log) => total + Number(log[key]), 0);
      const minutes = sum("min");
      const denominator =
        scope.perMode === "totals"
          ? 1
          : scope.perMode === "per36"
            ? minutes / 36
            : sample.length;
      const pct = (made: number, attempted: number) =>
        attempted ? (made / attempted) * 100 : Number.NaN;
      return [
        {
          ...player,
          team:
            new Set(sample.map((log) => log.team)).size > 1
              ? "MULTI"
              : sample[0].team,
          teamIds: [...new Set(sample.map((log) => log.team))],
          gp: sample.length,
          pts: denominator ? sum("pts") / denominator : Number.NaN,
          reb: denominator ? sum("reb") / denominator : Number.NaN,
          ast: denominator ? sum("ast") / denominator : Number.NaN,
          stl: denominator ? sum("stl") / denominator : Number.NaN,
          blk: denominator ? sum("blk") / denominator : Number.NaN,
          tov: denominator ? sum("tov") / denominator : Number.NaN,
          min: minutes / (scope.perMode === "totals" ? 1 : sample.length),
          fg: pct(sum("fgm"), sum("fga")),
          three: pct(sum("fg3m"), sum("fg3a")),
          ts: pct(sum("pts"), 2 * (sum("fga") + 0.44 * sum("fta"))),
          logs: sample,
        },
      ];
    });
}
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function format(value: number, percent = false) {
  return Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${percent ? "%" : ""}`
    : "—";
}
export function formatDataTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
export function csvExport(
  rows: PlayerStats[],
  scope: Scope,
  metadata: SeasonMetadata,
) {
  const cells = (values: unknown[]) =>
    values
      .map((value) => {
        const text = String(value);
        return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
      })
      .join(",");
  return [
    cells(["Source", metadata.source.label, ...metadata.source.urls]),
    cells([
      "Data fetched at",
      metadata.source.fetchedAt,
      "Observed coverage",
      metadata.from,
      metadata.to,
      "Complete season",
      metadata.complete,
    ]),
    cells(["Season", scope.season, "From", scope.from, "To", scope.to]),
    cells([
      "Team",
      scope.team,
      "Position",
      scope.position,
      "Minimum games",
      scope.minGames,
      "Mode",
      scope.perMode,
      "Search",
      scope.search,
    ]),
    cells(["Exported at", new Date().toISOString()]),
    cells([
      "player_id",
      "player",
      "team",
      "position",
      "GP",
      ...Object.values(metrics).map((metric) => metric.short),
    ]),
    ...rows.map((row) =>
      cells([
        row.id,
        row.name,
        row.team,
        row.position,
        row.gp,
        ...Object.keys(metrics).map((key) => format(row[key as Metric])),
      ]),
    ),
  ].join("\r\n");
}
