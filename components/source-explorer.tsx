"use client";
import { useEffect, useState } from "react";
import type { AnalysisMeta, AnalysisScope } from "@/lib/advanced";
import { useAnalysis } from "./use-analysis";
import { ScoringCourt } from "./scoring-court";
type SourceRow = Record<string, string | number | null>;
interface SourceResult {
  rows: SourceRow[];
  tables?: { name: string; rows: SourceRow[] }[];
  reason?: string;
  total: number;
  meta: AnalysisMeta;
  interpretation: string;
  fetchedAt?: string;
  unavailableMetrics?: string[];
}
const sourceTitles: Record<string, string> = {
  lineups: "Who works together?",
  onoff: "The game, with and without",
  teammates: "Teammate context",
  matchups: "Defensive matchup observations",
  teamAdvanced: "Team ratings",
  teamFourFactors: "The four factors",
  playtypes: "Scoring by play type",
  zones: "Where the shots come from",
};
const sourceColumns: Record<string, string[]> = {
  lineups: [
    "GROUP_NAME",
    "TEAM_ABBREVIATION",
    "GP",
    "MIN",
    "POSS",
    "OFF_RATING",
    "DEF_RATING",
    "NET_RATING",
    "EFG_PCT",
    "TS_PCT",
    "OREB_PCT",
    "TM_TOV_PCT",
    "PACE",
  ],
  onoff: [
    "VS_PLAYER_NAME",
    "TEAM_ABBREVIATION",
    "GP",
    "MIN",
    "OFF_RATING",
    "DEF_RATING",
    "NET_RATING",
    "OFF_MIN",
    "OFF_NET_RATING",
    "ON_OFF_NET",
  ],
  matchups: [
    "OFF_PLAYER_NAME",
    "DEF_PLAYER_NAME",
    "GP",
    "MATCHUP_MIN",
    "PARTIAL_POSS",
    "PLAYER_PTS",
    "TEAM_PTS",
    "MATCHUP_AST",
    "MATCHUP_TOV",
    "MATCHUP_FGM",
    "MATCHUP_FGA",
    "MATCHUP_FG_PCT",
  ],
  teamAdvanced: [
    "TEAM_NAME",
    "GP",
    "W",
    "L",
    "MIN",
    "OFF_RATING",
    "DEF_RATING",
    "NET_RATING",
    "EFG_PCT",
    "OREB_PCT",
    "TM_TOV_PCT",
    "PACE",
    "PIE",
  ],
  zones: [
    "PLAYER_NAME",
    "TEAM_ABBREVIATION",
    "ra:attempts",
    "ra:fg",
    "paint:attempts",
    "paint:fg",
    "mid:attempts",
    "mid:fg",
    "corner:attempts",
    "corner:fg",
    "aboveBreak:attempts",
    "aboveBreak:fg",
  ],
  teamFourFactors: [
    "TEAM_NAME",
    "GP",
    "W",
    "L",
    "EFG_PCT",
    "FTA_RATE",
    "TM_TOV_PCT",
    "OREB_PCT",
    "OPP_EFG_PCT",
    "OPP_FTA_RATE",
    "OPP_TOV_PCT",
    "OPP_OREB_PCT",
  ],
  playtypes: [
    "PLAYER_NAME",
    "TEAM_ABBREVIATION",
    "PLAY_TYPE",
    "GP",
    "POSS",
    "POSS_PCT",
    "PPP",
    "PTS",
    "FGM",
    "FGA",
    "FG_PCT",
    "EFG_PCT",
    "TOV_POSS_PCT",
    "FT_POSS_PCT",
    "PERCENTILE",
  ],
  teammates: [
    "GROUP_NAME",
    "TEAM_ABBREVIATION",
    "GP",
    "MIN",
    "POSS",
    "OFF_RATING",
    "DEF_RATING",
    "NET_RATING",
    "AST_PCT",
    "EFG_PCT",
    "TS_PCT",
  ],
};
function cell(value: SourceRow[string], key: string) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (key.includes("PCT") || key === "PERCENTILE" || key.endsWith(":fg"))
    return `${(value * 100).toFixed(1)}%`;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(key.includes("RATE") || key === "PPP" ? 3 : 1);
}
function pairMatrix(rows: SourceRow[]) {
  const players = new Map<string, string>();
  const pairs = new Map<string, number>();
  for (const row of rows) {
    const ids = String(row.GROUP_ID || "")
      .split("-")
      .filter(Boolean);
    const names = String(row.GROUP_NAME || "").split(" - ");
    if (ids.length !== 2) continue;
    ids.forEach((id, i) => players.set(id, names[i] || id));
    pairs.set([...ids].sort().join("-"), Number(row.NET_RATING));
  }
  return { players: [...players].slice(0, 18), pairs };
}
export function SourceExplorer({
  feature,
  scope,
  onPlayer,
  matrix,
  onMatrix,
}: {
  feature: string;
  scope: AnalysisScope;
  onPlayer: (id: number) => void;
  matrix: boolean;
  onMatrix: (value: boolean) => void;
}) {
  const [size, setSize] = useState(5);
  const [minMinutes, setMinMinutes] = useState(10);
  const [minPoss, setMinPoss] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("MIN");
  const [fullSeason, setFullSeason] = useState(
    ["matchups", "playtypes"].includes(feature) && !scope.start && !scope.end,
  );
  const [playType, setPlayType] = useState("Isolation");
  const [page, setPage] = useState(0);
  const hasMinutes = !["zones", "playtypes"].includes(feature);
  const hasPossessions = [
    "lineups",
    "teammates",
    "matchups",
    "teamAdvanced",
    "playtypes",
  ].includes(feature);
  const scopeKey = JSON.stringify(scope);
  useEffect(
    () => setPage(0),
    [
      search,
      minMinutes,
      minPoss,
      sort,
      size,
      matrix,
      fullSeason,
      playType,
      scopeKey,
    ],
  );
  const params = new URLSearchParams({
    size: String(matrix ? 2 : size),
    playType,
    search,
    minMins: hasMinutes ? String(minMinutes) : "0",
    minPoss: hasPossessions ? String(minPoss) : "0",
    sort,
    offset: String(page * 200),
    limit: matrix ? "2000" : "200",
  });
  const result = useAnalysis<SourceResult>(
    `explore/${feature}?${params}`,
    fullSeason ? { ...scope, start: null, end: null, split: "all" } : scope,
  );
  let rows = result.data?.rows || [];
  rows = rows.filter(
    (row) =>
      (typeof row.MIN !== "number" || row.MIN >= minMinutes) &&
      (typeof row.POSS !== "number" || row.POSS >= minPoss) &&
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(search.toLowerCase()),
      ),
  );
  rows = [...rows].sort((a, b) =>
    typeof a[sort] === "number" && typeof b[sort] === "number"
      ? Number(b[sort]) - Number(a[sort])
      : String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")),
  );
  const columns = (sourceColumns[feature] || []).filter((key) =>
    rows.some((row) => key in row),
  );
  const pairs = pairMatrix(rows);
  return (
    <section className="panel research-panel">
      <div className="workbench-heading">
        <div>
          <h2>{sourceTitles[feature] || feature}</h2>
          <p>
            {feature === "zones"
              ? "Strict NBA shot zones. Restricted area and hybrid rim definitions are different metrics."
              : "Public NBA observations for the selected date, season and team scope."}
          </p>
          <p>
            Counts are NBA source totals; percentages and ratings retain their
            source units.
          </p>
        </div>
      </div>
      <div className="workbench-controls">
        <label>
          Find in results
          <input
            aria-label="Find in analysis results"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Player or team…"
          />
        </label>
        {["matchups", "playtypes"].includes(feature) && (
          <label className="checkbox-control">
            <input
              type="checkbox"
              checked={fullSeason}
              onChange={(event) => setFullSeason(event.target.checked)}
            />
            Use full season (ignore dates and split)
          </label>
        )}
        {feature === "playtypes" && (
          <label>
            Play type
            <select
              value={playType}
              onChange={(event) => setPlayType(event.target.value)}
            >
              {[
                ["Isolation", "Isolation"],
                ["Transition", "Transition"],
                ["PRBallHandler", "Pick-and-roll ball handler"],
                ["PRRollman", "Pick-and-roll roll man"],
                ["Postup", "Post-up"],
                ["Spotup", "Spot-up"],
                ["Handoff", "Handoff"],
                ["Cut", "Cut"],
                ["OffScreen", "Off screen"],
                ["OffRebound", "Putback"],
                ["Misc", "Miscellaneous"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {feature === "lineups" && (
          <>
            <label>
              Lineup size
              <select
                aria-label="Lineup size"
                value={matrix ? 2 : size}
                disabled={matrix}
                onChange={(event) => setSize(Number(event.target.value))}
              >
                {[2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={matrix}
                onChange={(event) => onMatrix(event.target.checked)}
              />
              Two-player matrix
            </label>
          </>
        )}
        {hasMinutes && (
          <label>
            Minimum minutes
            <input
              type="number"
              min={0}
              value={minMinutes}
              onChange={(event) =>
                setMinMinutes(Math.max(0, Number(event.target.value)))
              }
            />
          </label>
        )}
        {hasPossessions && (
          <label>
            Minimum possessions
            <input
              type="number"
              min={0}
              value={minPoss}
              onChange={(event) =>
                setMinPoss(Math.max(0, Number(event.target.value)))
              }
            />
          </label>
        )}
      </div>
      {result.loading && (
        <div className="research-status" role="status">
          Loading NBA observations…
        </div>
      )}
      {result.error && (
        <div className="research-status" role="alert">
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Retry source
          </button>
        </div>
      )}
      {result.data?.reason && (
        <div className="research-empty">
          <h3>This view is unavailable for this scope</h3>
          <p>{result.data.reason}</p>
        </div>
      )}
      {result.data && !result.data.reason && (
        <>
          <p className="research-table-summary">
            {result.data.total} matching observations · Source retrieved{" "}
            {result.data.fetchedAt
              ? new Date(result.data.fetchedAt).toLocaleString()
              : "time unavailable"}
          </p>
          {result.data.unavailableMetrics?.map((reason) => (
            <p className="research-footnote" key={reason}>
              Unavailable: {reason}
            </p>
          ))}
          {feature === "zones" && <ScoringCourt rows={rows} />}
          {matrix && feature === "lineups" ? (
            scope.team ? (
              <div
                className="research-table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Two player net rating matrix"
              >
                <table className="research-table">
                  <caption>
                    NBA two-player shared-floor net ratings · up to 18 players ·
                    overlapping samples
                  </caption>
                  <thead>
                    <tr>
                      <th>Player</th>
                      {pairs.players.map(([id, name]) => (
                        <th key={id}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pairs.players.map(([id, name]) => (
                      <tr key={id}>
                        <th scope="row">{name}</th>
                        {pairs.players.map(([other]) => {
                          const value =
                            id === other
                              ? null
                              : pairs.pairs.get([id, other].sort().join("-"));
                          return (
                            <td
                              key={other}
                              style={
                                value != null
                                  ? {
                                      backgroundColor:
                                        value >= 0 ? "#e9efe4" : "#f9eee7",
                                    }
                                  : undefined
                              }
                            >
                              {value == null ? "—" : value.toFixed(1)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                Select a team in Filters above to see its two-player matrix.
              </p>
            )
          ) : (
            <div
              className="research-table-scroll"
              tabIndex={0}
              role="region"
              aria-label={`${feature} source observations`}
            >
              <table className="research-table">
                <thead>
                  <tr>
                    {columns.map((key) => (
                      <th key={key}>
                        <button onClick={() => setSort(key)}>
                          {key.replaceAll("_", " ").replaceAll(":", " ")}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, index) => (
                    <tr key={index}>
                      {columns.map((key) => (
                        <td key={key}>
                          {key.endsWith(":fg") &&
                          !row[key.replace(":fg", ":attempts")] ? (
                            "—"
                          ) : key === "PLAYER_NAME" &&
                            typeof row.PLAYER_ID === "number" ? (
                            <button
                              onClick={() => onPlayer(Number(row.PLAYER_ID))}
                            >
                              {cell(row[key], key)}
                            </button>
                          ) : (
                            cell(row[key], key)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!rows.length && (
            <div className="research-empty">
              <h3>No qualified observations</h3>
              <p>
                Reduce minutes or possessions, clear search, or choose another
                scope.
              </p>
            </div>
          )}
          {!matrix && result.data.total > 200 && (
            <div className="table-pagination">
              <span>
                Page {page + 1} · {result.data.total} observations
              </span>
              <div>
                <button
                  className="button"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  Previous observations
                </button>
                <button
                  className="button"
                  disabled={(page + 1) * 200 >= result.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next observations
                </button>
              </div>
            </div>
          )}
          <p className="research-footnote">
            {result.data.interpretation} Ratings are points per 100 NBA
            possessions; shooting percentages use the provider’s recorded
            attempts. On/off difference is on-court net rating minus off-court
            net rating.
          </p>
        </>
      )}
    </section>
  );
}
