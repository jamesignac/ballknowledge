"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Bookmark,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Columns3,
  Compass,
  FolderHeart,
  Info,
  Menu,
  Search,
  Share2,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  aggregatePlayers,
  csvExport,
  defaultScope,
  format,
  formatDataTime,
  metrics,
  parseScope,
  scopeParams,
  seasonBounds,
  type Metric,
  type Scope,
} from "@/lib/analytics";
import { players, teams, seasons } from "@/lib/data";
import { useSeasonData } from "./use-season-data";
import { Comparison } from "./comparison";
import { PlayerAvatar } from "./player-avatar";
import { PlayerProfile } from "./player-profile";
import { PlayerTable } from "./player-table";
import { Scatter } from "./scatter";
import { SeasonGames } from "./season-games";
import { SeasonHub } from "./season-hub";
import { ResearchWorkspace } from "./research-workspace";
import { ResearchPlayerProfile } from "./research-player-profile";
import {
  analysisScope,
  isAnalysisScope,
  type AnalysisScope,
} from "@/lib/advanced";
import { Rankings } from "./rankings";
import { resolveRoute } from "@/lib/routes";
import { Spotlight } from "./spotlight";

type View =
  "players" | "compare" | "teams" | "games" | "saved" | "research" | "rankings";
interface SavedView {
  id: string;
  name: string;
  query: string;
}
const titles: Record<View, [string, string]> = {
  research: [
    "The research desk",
    "Follow the question. Build the view that answers it.",
  ],
  rankings: [
    "Your player rankings",
    "Put your basketball perspective on the board.",
  ],
  players: [
    "Player explorer",
    "Find your angle. Let the numbers tell the story.",
  ],
  compare: [
    "Player comparison",
    "Put their games side by side. See what sets them apart.",
  ],
  teams: ["Team explorer", "Explore the players behind each team’s numbers."],
  games: [
    "Season calendar",
    "Follow the schedule. Find the story behind the score.",
  ],
  saved: ["Your scouting desk", "Good questions deserve a second look."],
};
function Basketball({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 24 : 34}
      height={small ? 24 : 34}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="17" />
      <path d="M3 20h34M20 3v34M9 7c15 6 15 20 0 26M31 7c-15 6-15 20 0 26" />
    </svg>
  );
}

export function Workspace() {
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [view, setView] = useState<View>("players");
  const [selected, setSelected] = useState<number[]>([]);
  const [activePlayer, setActivePlayer] = useState<number | null>(null);
  const [profileScope, setProfileScope] = useState<AnalysisScope | null>(null);
  const fullSeasonWindow = useRef(true);
  const [tab, setTab] = useState<"table" | "scatter">("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState<SavedView[]>([]);
  const [ready, setReady] = useState(false);
  const help = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  function restore() {
    const params = new URLSearchParams(window.location.search);
    fullSeasonWindow.current =
      params.get("window") === "season" ||
      (!params.has("from") && !params.has("to"));
    const route = resolveRoute(window.location.pathname);
    if (!params.has("season") && route?.season)
      params.set("season", route.season);
    if (!params.has("team") && route?.team) params.set("team", route.team);
    if (!params.has("lab") && route?.section) {
      params.set(
        "lab",
        JSON.stringify({ section: route.section, matrix: route.matrix }),
      );
      window.history.replaceState(null, "", `?${params}`);
    }
    setScope(parseScope(params));
    const nextView = params.get("view") || route?.view;
    setView(
      nextView && Object.hasOwn(titles, nextView)
        ? (nextView as View)
        : "players",
    );
    setSelected(
      (params.get("compare") || "")
        .split(",")
        .map(Number)
        .filter(
          (id, index, list) =>
            players.some((player) => player.id === id) &&
            list.indexOf(id) === index,
        )
        .slice(0, 4),
    );
    setTab(params.get("tab") === "scatter" ? "scatter" : "table");
    const profile = Number(params.get("player") || route?.player);
    setActivePlayer(
      Number.isInteger(profile) && profile > 0 && profile <= 2147483647
        ? profile
        : null,
    );
    try {
      const parsed: unknown = JSON.parse(params.get("analysis") || "null");
      setProfileScope(
        isAnalysisScope(parsed) &&
          seasons.some((item) => item.id === parsed.season)
          ? parsed
          : null,
      );
    } catch {
      setProfileScope(null);
    }
  }
  useEffect(() => {
    restore();
    setReady(true);
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem("ballknowledge:views:v1") || "[]",
      );
      if (Array.isArray(parsed))
        setSaved(
          parsed
            .filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                typeof item.query === "string",
            )
            .slice(0, 20),
        );
    } catch {
      /* Corrupt or unavailable storage should not prevent exploration. */
    }
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const params = scopeParams(scope);
    if (fullSeasonWindow.current) params.set("window", "season");
    const labState = new URLSearchParams(window.location.search).get("lab");
    if (labState) params.set("lab", labState);
    params.set("view", view);
    params.set("tab", tab);
    if (selected.length) params.set("compare", selected.join(","));
    if (activePlayer) params.set("player", String(activePlayer));
    if (activePlayer && profileScope)
      params.set("analysis", JSON.stringify(profileScope));
    const paths: Record<View, string> = {
      players: "/players",
      research: "/stats",
      compare: "/compare/players",
      teams: "/teams",
      games: `/season/${scope.season}`,
      saved: "/workspace",
      rankings: "/rankings/players",
    };
    window.history.replaceState(
      null,
      "",
      `${activePlayer ? `/players/${activePlayer}` : paths[view]}?${params}`,
    );
  }, [scope, view, tab, selected, activePlayer, profileScope, ready]);
  const update = (patch: Partial<Scope>) =>
    setScope((previous) => ({ ...previous, ...patch }));
  const {
    data,
    loaded,
    error: dataError,
    retry,
  } = useSeasonData(
    scope.season,
    ready && view !== "research" && view !== "saved",
  );
  const metadata = loaded
    ? data.metadata
    : seasons.find((entry) => entry.id === scope.season)!;
  useEffect(() => {
    if (loaded && fullSeasonWindow.current)
      setScope((previous) =>
        previous.season === data.metadata.id &&
        (previous.from !== data.metadata.from ||
          previous.to !== data.metadata.to)
          ? { ...previous, from: data.metadata.from, to: data.metadata.to }
          : previous,
      );
  }, [loaded, data.metadata.id, data.metadata.from, data.metadata.to]);
  const rows = aggregatePlayers(scope, data);
  const population = aggregatePlayers(
    {
      ...scope,
      search: "",
      team: "ALL",
      position: "ALL",
    },
    data,
  );
  const profileStats = population.find((row) => row.id === activePlayer);
  const spotlight = [...rows].sort(
    (a, b) => b.pts + b.reb + b.ast - (a.pts + a.reb + a.ast),
  )[0];
  const navigate = (next: View) => {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  function toggle(id: number) {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id);
      if (previous.length >= 4) {
        notify("Your comparison is full. Remove a player to add another.");
        return previous;
      }
      return [...previous, id];
    });
  }
  function exportCsv() {
    const exportRows =
      view === "compare"
        ? population.filter((player) => selected.includes(player.id))
        : rows;
    const exportScope =
      view === "compare"
        ? { ...scope, team: "ALL", position: "ALL", search: "" }
        : scope;
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csvExport(exportRows, exportScope, metadata)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ballknowledge-players-${scope.season}-${scope.from}-${scope.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(
      `Exported ${exportRows.length} players with scope and source details.`,
    );
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Analysis link copied. Filters and comparisons are included.");
    } catch {
      notify("Copy the address from your browser to share this analysis.");
    }
  }
  function storeSaved(next: SavedView[]) {
    try {
      localStorage.setItem("ballknowledge:views:v1", JSON.stringify(next));
      setSaved(next);
      return true;
    } catch {
      notify(
        "Your browser could not save this view. You can still copy its link.",
      );
      return false;
    }
  }
  function saveView() {
    const query = window.location.search;
    if (saved.some((item) => item.query === query)) {
      notify("This view is already on your scouting desk.");
      return;
    }
    const name = `${view === "compare" ? "Player comparison" : scope.search ? `Search: ${scope.search}` : scope.team !== "ALL" ? `${scope.team} players` : titles[view][0]} · ${scope.season}`;
    if (
      storeSaved(
        [{ id: crypto.randomUUID(), name, query }, ...saved].slice(0, 20),
      )
    )
      notify("View saved to your scouting desk.");
  }
  const navigation = [
    { id: "players" as const, label: "Player explorer", icon: Compass },
    { id: "research" as const, label: "Advanced research", icon: Columns3 },
    { id: "compare" as const, label: "Compare players", icon: ArrowLeftRight },
    { id: "teams" as const, label: "Team explorer", icon: Users },
    { id: "games" as const, label: "Season calendar", icon: CalendarDays },
    { id: "rankings" as const, label: "Player rankings", icon: Bookmark },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {menuOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <button
          className="brand"
          onClick={() => navigate("players")}
          aria-label="Ballknowledge home"
        >
          <span className="brand-mark">
            <Basketball />
          </span>
          <span>
            ballknowledge<span className="brand-period">.</span>
          </span>
        </button>
        <div className="league-switch">
          <span className="league-logo">NBA</span>
          <div>
            <strong>National Basketball</strong>
            <span>Association</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          <p className="nav-label">THE WORKSPACE</p>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === "compare" && selected.length > 0 && (
                <span className="nav-count">{selected.length}</span>
              )}
            </button>
          ))}
          <div className="nav-divider" />
          <p className="nav-label">MAKE IT YOURS</p>
          <button
            className={`nav-item ${view === "saved" ? "active" : ""}`}
            onClick={() => navigate("saved")}
            aria-current={view === "saved" ? "page" : undefined}
          >
            <FolderHeart size={19} strokeWidth={1.7} />
            Saved views
            {saved.length > 0 && (
              <span className="nav-count">{saved.length}</span>
            )}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-ball">
              <Basketball small />
            </span>
            <strong>
              Watch the game.
              <br />
              Understand it here.
            </strong>
            <p>
              A little more context.
              <br />A lot more ballknowledge.
            </p>
          </div>
          <button
            className="nav-item help-button"
            onClick={() => help.current?.showModal()}
          >
            <CircleHelp size={18} />
            Data & methodology
            <ArrowUpRightIcon />
          </button>
          <div className="workspace-user">
            <span className="user-avatar">BK</span>
            <div>
              <strong>Your workspace</strong>
              <span>Free to explore</span>
            </div>
            <span className="guest-tag">LOCAL</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "saved" ? "Saved views" : "NBA intelligence"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="demo-status">
              <span />
              NBA data workspace
            </span>
            <button
              className="icon-button"
              aria-label="About the NBA data"
              onClick={() => help.current?.showModal()}
            >
              <Info size={18} />
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <h1>
                {titles[view][0]}
                <span className="heading-period">.</span>
              </h1>
              <p>{titles[view][1]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button icon-only-mobile"
                onClick={share}
                aria-label="Share analysis"
              >
                <Share2 size={15} />
                <span>Share</span>
              </button>
              <button
                className="button icon-only-mobile"
                onClick={saveView}
                aria-label="Save view"
              >
                <Bookmark size={15} />
                <span>Save view</span>
              </button>
              {view !== "research" && (
                <button
                  className="button primary"
                  disabled={!loaded}
                  onClick={exportCsv}
                >
                  <ArrowDownToLine size={16} />
                  <span>Export CSV</span>
                </button>
              )}
            </div>
          </div>
          {view !== "saved" && (
            <>
              <div className="scope-toolbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search players"
                    placeholder="Search any player…"
                    value={scope.search}
                    onChange={(event) => {
                      update({ search: event.target.value });
                      if (view !== "players" && view !== "research")
                        navigate("players");
                    }}
                  />
                  {scope.search && (
                    <button
                      className="clear-search"
                      aria-label="Clear player search"
                      onClick={() => update({ search: "" })}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="scope-selects">
                  <label className="select-control">
                    <CalendarDays size={15} />
                    <select
                      aria-label="Season"
                      value={scope.season}
                      onChange={(event) => {
                        fullSeasonWindow.current = true;
                        update({
                          season: event.target.value,
                          ...seasonBounds(event.target.value),
                        });
                      }}
                    >
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.id.replace("-", "–")} season
                        </option>
                      ))}
                    </select>
                  </label>
                  {view !== "research" && (
                    <label className="select-control">
                      <ChartNoAxesCombined size={15} />
                      <select
                        aria-label="Stat normalization"
                        value={scope.perMode}
                        onChange={(event) =>
                          update({
                            perMode: event.target.value as Scope["perMode"],
                          })
                        }
                      >
                        <option value="per_game">Per game</option>
                        <option value="per36">Per 36 minutes</option>
                        <option value="totals">Totals</option>
                      </select>
                    </label>
                  )}
                  <button
                    className={`button filters-button ${filtersOpen ? "pressed" : ""}`}
                    aria-expanded={filtersOpen}
                    aria-controls="analysis-filters"
                    onClick={() => setFiltersOpen(!filtersOpen)}
                  >
                    <SlidersHorizontal size={15} />
                    Filters
                    {(scope.team !== "ALL" || scope.position !== "ALL") && (
                      <span className="filter-indicator" />
                    )}
                  </button>
                </div>
              </div>
              {filtersOpen && (
                <div id="analysis-filters" className="filter-panel">
                  <label>
                    Team
                    <select
                      aria-label="Team filter"
                      value={scope.team}
                      onChange={(event) => update({ team: event.target.value })}
                    >
                      <option value="ALL">All teams</option>
                      {teams.map((team) => (
                        <option key={team.abbr} value={team.abbr}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Position
                    <select
                      aria-label="Position filter"
                      value={scope.position}
                      onChange={(event) =>
                        update({ position: event.target.value })
                      }
                    >
                      <option value="ALL">All positions</option>
                      {["G", "F", "C"].map((position) => (
                        <option key={position}>{position}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Min. games
                    <input
                      aria-label="Minimum games"
                      type="number"
                      min="0"
                      max="82"
                      value={scope.minGames}
                      onChange={(event) =>
                        update({
                          minGames: Math.max(
                            0,
                            Math.min(82, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    From
                    <input
                      aria-label="Date from"
                      type="date"
                      value={scope.from}
                      max={scope.to}
                      onChange={(event) => {
                        if (
                          event.target.value &&
                          event.target.value <= scope.to
                        ) {
                          fullSeasonWindow.current = false;
                          update({ from: event.target.value });
                        }
                      }}
                    />
                  </label>
                  <label>
                    To
                    <input
                      aria-label="Date to"
                      type="date"
                      value={scope.to}
                      min={scope.from}
                      onChange={(event) => {
                        if (
                          event.target.value &&
                          event.target.value >= scope.from
                        ) {
                          fullSeasonWindow.current = false;
                          update({ to: event.target.value });
                        }
                      }}
                    />
                  </label>
                  <button
                    className="text-button"
                    onClick={() => {
                      fullSeasonWindow.current = true;
                      setScope({
                        ...defaultScope,
                        season: scope.season,
                        ...seasonBounds(scope.season),
                      });
                    }}
                  >
                    Reset filters
                  </button>
                </div>
              )}
              {view !== "research" && (
                <div className="scope-caption">
                  <span>
                    <span className="scope-dot" />
                    Regular season<span className="caption-divider">/</span>
                    {scope.from.replaceAll("-", ".")} —{" "}
                    {scope.to.replaceAll("-", ".")}
                  </span>
                  <span>
                    NBA Stats snapshot{" "}
                    <button
                      aria-label="Explain NBA data source"
                      onClick={() => help.current?.showModal()}
                    >
                      <Info size={12} />
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
          {view !== "saved" && view !== "research" && (
            <div className="data-provenance">
              <span>
                {metadata.playerCount} players ·{" "}
                {metadata.gameCount.toLocaleString()} completed games ·{" "}
                {metadata.complete
                  ? "Complete regular season"
                  : "Season in progress"}
              </span>
              <span>
                Data through {metadata.to} · Retrieved{" "}
                {formatDataTime(metadata.source.fetchedAt)}
              </span>
            </div>
          )}
          {view !== "saved" && view !== "research" && !loaded && (
            <section
              className="panel data-loading"
              role={dataError ? "alert" : "status"}
            >
              <h2>
                {dataError
                  ? "Season data is unavailable."
                  : "Loading the full player database…"}
              </h2>
              <p>{dataError || `${metadata.source.label} · ${metadata.id}`}</p>
              {dataError && (
                <button className="button primary" onClick={retry}>
                  Retry season data
                </button>
              )}
            </section>
          )}
          {view === "research" && ready && (
            <ResearchWorkspace
              scope={scope}
              fullSeason={fullSeasonWindow.current}
              onPlayer={(id, analysis) => {
                setProfileScope(analysis);
                setActivePlayer(id);
              }}
            />
          )}
          {view === "rankings" && loaded && (
            <Rankings players={rows} season={scope.season} />
          )}
          {view === "players" && loaded && (
            <>
              <div className="discovery-grid">
                {spotlight ? (
                  <Spotlight
                    player={spotlight}
                    selected={selected.includes(spotlight.id)}
                    onPlayer={() => setActivePlayer(spotlight.id)}
                    onToggle={() => toggle(spotlight.id)}
                  />
                ) : (
                  <section className="spotlight spotlight-empty">
                    <Search size={30} />
                    <h2>No player found.</h2>
                    <p>Try clearing your search or adjusting the filters.</p>
                    <button
                      className="button"
                      onClick={() => setScope(defaultScope)}
                    >
                      Reset exploration
                    </button>
                  </section>
                )}
                <Scatter
                  rows={rows}
                  x={scope.x}
                  y={scope.y}
                  selected={selected}
                  onAxis={(axis, value) => update({ [axis]: value })}
                  onPlayer={setActivePlayer}
                />
              </div>
              <section className="panel database-panel">
                <div className="database-heading">
                  <div
                    className="table-tabs"
                    role="tablist"
                    aria-label="Player data view"
                  >
                    <button
                      role="tab"
                      aria-selected={tab === "table"}
                      onClick={() => setTab("table")}
                      id="table-tab"
                      aria-controls="table-view"
                    >
                      <Columns3 size={16} />
                      Player database{" "}
                      <span className="count-badge">{rows.length}</span>
                    </button>
                    <button
                      role="tab"
                      aria-selected={tab === "scatter"}
                      onClick={() => setTab("scatter")}
                      id="scatter-tab"
                      aria-controls="scatter-view"
                    >
                      <ChartNoAxesCombined size={16} />
                      Scatter view
                    </button>
                  </div>
                  <span className="table-hint">
                    Pick players to compare <PlusSmall />
                  </span>
                </div>
                <div
                  role="tabpanel"
                  id={tab === "table" ? "table-view" : "scatter-view"}
                  aria-labelledby={
                    tab === "table" ? "table-tab" : "scatter-tab"
                  }
                >
                  {tab === "table" ? (
                    <PlayerTable
                      rows={rows}
                      selected={selected}
                      onToggle={toggle}
                      onPlayer={setActivePlayer}
                    />
                  ) : (
                    <Scatter
                      rows={rows}
                      x={scope.x}
                      y={scope.y}
                      selected={selected}
                      onAxis={(axis, value) => update({ [axis]: value })}
                      onPlayer={setActivePlayer}
                      full
                    />
                  )}
                </div>
                <div className="database-foot">
                  <span>
                    {rows.length} players · Minimum {scope.minGames} games
                  </span>
                  <button
                    className="text-button"
                    onClick={() => help.current?.showModal()}
                  >
                    How are these stats calculated? <ArrowRight size={13} />
                  </button>
                </div>
              </section>
            </>
          )}
          {view === "compare" && loaded && (
            <Comparison
              selected={selected}
              rows={population}
              onToggle={toggle}
              onExplore={() => navigate("players")}
            />
          )}
          {view === "teams" && loaded && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Behind the badge</h2>
                  <p>
                    Players who appeared for each team in the selected window.
                    Traded players can appear under multiple teams.
                  </p>
                </div>
                <Users size={21} />
              </div>
              <div className="teams-grid">
                {teams
                  .filter(
                    (team) => scope.team === "ALL" || team.abbr === scope.team,
                  )
                  .map((team) => {
                    const roster = rows.filter((row) =>
                      row.teamIds.includes(team.abbr),
                    );
                    return (
                      <button
                        className="team-card"
                        key={team.abbr}
                        onClick={() => {
                          update({ team: team.abbr, search: "" });
                          navigate("players");
                        }}
                      >
                        <span
                          className="team-monogram"
                          style={{ color: team.color }}
                        >
                          {team.abbr}
                        </span>
                        <div>
                          <h3>{team.name}</h3>
                          <span>
                            {roster.length} eligible player
                            {roster.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <ArrowRight size={17} />
                      </button>
                    );
                  })}
              </div>
            </section>
          )}
          {view === "games" && loaded && (
            <>
              <SeasonHub
                scope={scope}
                games={data.games}
                onWindow={(from, to) => {
                  fullSeasonWindow.current = false;
                  update({ from, to });
                }}
                onResearch={() => navigate("research")}
              />
              <SeasonGames
                games={data.games}
                key={`${scope.season}-${scope.from}-${scope.to}-${scope.team}`}
                scope={scope}
              />
            </>
          )}
          {view === "saved" && (
            <section className="panel saved-panel">
              {saved.length ? (
                <>
                  <div className="panel-heading">
                    <div>
                      <h2>Pick up where you left off</h2>
                      <p>
                        Your saved scopes and comparisons stay in this browser.
                      </p>
                    </div>
                    <Bookmark size={20} />
                  </div>
                  {saved.map((item) => (
                    <article className="saved-row" key={item.id}>
                      <Bookmark size={20} />
                      <div>
                        <h3>{item.name}</h3>
                        <p>
                          {parseScope(new URLSearchParams(item.query)).from} to{" "}
                          {parseScope(new URLSearchParams(item.query)).to}
                        </p>
                      </div>
                      <button
                        className="button"
                        onClick={() => {
                          window.history.pushState(null, "", item.query);
                          restore();
                        }}
                      >
                        Open view
                        <ArrowRight size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete saved view ${item.name}`}
                        onClick={() =>
                          storeSaved(
                            saved.filter((value) => value.id !== item.id),
                          )
                        }
                      >
                        <X size={17} />
                      </button>
                    </article>
                  ))}
                </>
              ) : (
                <div className="empty-state">
                  <FolderHeart size={38} />
                  <h2>A place for your next big take.</h2>
                  <p>
                    Find a player, set your filters, and save a view. It’ll be
                    waiting here.
                  </p>
                  <button
                    className="button primary"
                    onClick={() => navigate("players")}
                  >
                    Start exploring
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Basketball small />
              More context. Better basketball conversations.
            </span>
            <button onClick={() => help.current?.showModal()}>
              Data sources & methodology <ArrowUpRightIcon />
            </button>
          </footer>
        </main>
      </div>
      {selected.length > 0 && view !== "compare" && (
        <div className="comparison-dock" aria-label="Selected players">
          <div className="dock-players">
            {selected.map((id) => {
              const player = players.find((item) => item.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${player.name} from comparison`}
                  title={`Remove ${player.name}`}
                >
                  <PlayerAvatar player={player} />
                  <span>{player.name.split(" ").at(-1)}</span>
                  <X size={12} />
                </button>
              );
            })}
          </div>
          <span className="dock-count">{selected.length}/4</span>
          <button
            className="button primary"
            onClick={() => navigate("compare")}
          >
            <ArrowLeftRight size={16} />
            Compare<span className="compare-number">{selected.length}</span>
            <ArrowRight size={15} />
          </button>
          <button
            className="icon-button"
            onClick={() => setSelected([])}
            aria-label="Clear comparison"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {activePlayer &&
        (profileScope ||
          view === "research" ||
          !players.some((player) => player.id === activePlayer)) && (
          <ResearchPlayerProfile
            key={activePlayer}
            id={activePlayer}
            scope={profileScope || analysisScope(scope)}
            onClose={() => {
              setActivePlayer(null);
              setProfileScope(null);
            }}
          />
        )}
      {activePlayer &&
        !profileScope &&
        view !== "research" &&
        players.some((player) => player.id === activePlayer) &&
        loaded && (
          <PlayerProfile
            key={activePlayer}
            id={activePlayer}
            stats={profileStats}
            metadata={metadata}
            scope={scope}
            selected={selected.includes(activePlayer)}
            onToggle={() => toggle(activePlayer)}
            onClose={() => setActivePlayer(null)}
          />
        )}
      <dialog
        ref={help}
        className="help-dialog"
        aria-labelledby="methodology-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) help.current?.close();
        }}
      >
        <div className="help-content">
          <div className="profile-top">
            <span>Know your numbers</span>
            <button
              className="icon-button"
              autoFocus
              onClick={() => help.current?.close()}
              aria-label="Close methodology"
            >
              <X size={20} />
            </button>
          </div>
          <h2 id="methodology-title">Real games. Traceable numbers.</h2>
          <p>
            Regular-season explorer snapshot: {metadata.source.label}.{" "}
            {metadata.playerCount} players, {metadata.gameCount} completed
            regular-season games, and{" "}
            {metadata.appearanceCount.toLocaleString()} player appearances for{" "}
            {metadata.id}. Observed coverage: {metadata.from} through{" "}
            {metadata.to}. Retrieved {metadata.source.fetchedAt}. This is a
            local snapshot, not a live feed.
          </p>
          <h3>One scope, every view</h3>
          <p>
            Date windows include both endpoints. The original explorer uses
            recorded regular-season appearances; Advanced research also supports
            imported playoffs. Team filters use each game's team assignment,
            including trades. Minimum games, team and position define the
            eligible population; search narrows the displayed results. The
            original comparison shares the selected window. Research player and
            team comparisons use a separate full season for each column and
            state those selections explicitly.
          </p>
          <h3>The math behind the metrics</h3>
          <dl>
            {Object.entries(metrics).map(([key, metric]) => (
              <div key={key}>
                <dt>{metric.short}</dt>
                <dd>{metric.definition}</dd>
              </div>
            ))}
          </dl>
          <p>
            Per 36 uses recorded minutes and seconds when provided. Percentages
            always use summed makes and attempts; they are never averaged across
            games. No attempts is shown as —. Research per-75/per-100 counts
            require matching public NBA possession samples. Tracking, hustle,
            lineup and on/off observations come from compatible NBA feeds, with
            their own retrieval times. Unsupported samples and disconnected
            impact models are labeled unavailable. These observations describe
            association and do not establish causal impact.
          </p>
          <h3>Identity & assets</h3>
          <p>
            Official NBA IDs identify players. Multi-team windows show MULTI;
            team filters isolate the relevant appearances. Position, height, and
            jersey details come from season roster snapshots and remain
            unavailable when missing. G and F filters include hybrid roster
            positions. Headshots are sourced from the public NBA CDN. Fonts are
            open-license Manrope and Barlow Condensed. No account is needed;
            saved views remain in your browser.
          </p>
        </div>
      </dialog>
      <div
        className={`toast ${toast ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Check size={17} />
            {toast}
          </>
        )}
      </div>
    </div>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M4 12 12 4M4 4h8v8" />
    </svg>
  );
}
function PlusSmall() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="16" height="16" rx="4" />
      <path d="M6 10h8M10 6v8" />
    </svg>
  );
}
