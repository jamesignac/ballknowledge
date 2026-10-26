export function resolveRoute(path: string): {
  view?: string;
  season?: string;
  player?: string;
  team?: string;
  section?: string;
  matrix?: boolean;
} | null {
  if (path === "/") return {};
  const simple: Record<
    string,
    { view: string; section?: string; matrix?: boolean }
  > = {
    "/players": { view: "players" },
    "/stats": { view: "research", section: "stats" },
    "/explore/players": { view: "research", section: "scatter" },
    "/compare/players": { view: "compare" },
    "/teams": { view: "teams" },
    "/workspace": { view: "saved" },
    "/lineups": { view: "research", section: "lineups" },
    "/compare/teams": { view: "research", section: "teamCompare" },
    "/explore/history": { view: "research", section: "history" },
    "/lineups/matrix": { view: "research", section: "lineups", matrix: true },
    "/impact/on-off": { view: "research", section: "onoff" },
    "/impact/teammates": { view: "research", section: "teammates" },
    "/matchups": { view: "research", section: "matchups" },
    "/rankings/players": { view: "rankings" },
    "/playoffs": { view: "research", section: "playoffs" },
  };
  if (simple[path]) return simple[path];
  const season = path.match(/^\/season\/(20\d{2}-\d{2})$/);
  if (season) return { view: "games", season: season[1] };
  const player = path.match(/^\/players\/(\d{1,10})$/);
  if (player) return { view: "players", player: player[1] };
  const team = path.match(/^\/teams\/([A-Z]{3})$/);
  if (team) return { view: "research", team: team[1], section: "teamAdvanced" };
  return null;
}
