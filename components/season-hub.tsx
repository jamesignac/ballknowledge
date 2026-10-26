"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { analysisScope } from "@/lib/advanced";
import type { Scope } from "@/lib/analytics";
import type { Game } from "@/lib/data";
import { teams } from "@/lib/data";
import { useAnalysis } from "./use-analysis";

interface ScheduledGame {
  id: string;
  date: string;
  season: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  statusText?: string;
  tipoff?: string;
}
export function SeasonHub({
  scope,
  games,
  onWindow,
  onResearch,
}: {
  scope: Scope;
  games: Game[];
  onWindow: (from: string, to: string) => void;
  onResearch: () => void;
}) {
  const [month, setMonth] = useState(scope.from.slice(0, 7));
  const schedule = useAnalysis<{
    games: ScheduledGame[];
    fetchedAt: string;
    reason?: string;
  }>("schedule", { ...analysisScope(scope), start: null, end: null });
  const calendarGames: ScheduledGame[] =
    schedule.data?.games ||
    games
      .filter(
        (g) => scope.team === "ALL" || [g.home, g.away].includes(scope.team),
      )
      .map((g) => ({ ...g, status: "final" }));
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const offset = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const counts = new Map<string, number>();
  calendarGames.forEach((game) =>
    counts.set(game.date, (counts.get(game.date) || 0) + 1),
  );
  const selectedGames = calendarGames.filter(
    (game) => game.date >= scope.from && game.date <= scope.to,
  );
  const standings = useMemo(() => {
    const records = new Map<
      string,
      {
        team: string;
        wins: number;
        losses: number;
        points: number;
        opponent: number;
      }
    >();
    games
      .filter((game) => game.date >= scope.from && game.date <= scope.to)
      .forEach((game) => {
        for (const [team, pts, opp] of [
          [game.home, game.homeScore, game.awayScore],
          [game.away, game.awayScore, game.homeScore],
        ] as const) {
          const record = records.get(team) || {
            team,
            wins: 0,
            losses: 0,
            points: 0,
            opponent: 0,
          };
          record.wins += pts > opp ? 1 : 0;
          record.losses += pts < opp ? 1 : 0;
          record.points += pts;
          record.opponent += opp;
          records.set(team, record);
        }
      });
    return [...records.values()].sort(
      (a, b) =>
        b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses) ||
        b.points - b.opponent - (a.points - a.opponent),
    );
  }, [games, scope.from, scope.to]);
  const [boxId, setBoxId] = useState("");
  function moveMonth(amount: number) {
    const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
    setMonth(date.toISOString().slice(0, 7));
  }
  return (
    <div className="season-hub">
      <section className="panel research-panel">
        <div className="workbench-heading">
          <div>
            <h2>A season, one day at a time</h2>
            <p>
              Select a day or month to apply that window across the workspace.
            </p>
          </div>
          <button className="button" onClick={onResearch}>
            Explore this window’s stats
          </button>
        </div>
        <div className="month-heading">
          <button
            className="icon-button"
            aria-label="Previous calendar month"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <label>
            Calendar month
            <input
              aria-label="Calendar month"
              type="month"
              min={`${scope.season.slice(0, 4)}-07`}
              max={`${Number(scope.season.slice(0, 4)) + 1}-07`}
              value={month}
              onChange={(event) =>
                event.target.value && setMonth(event.target.value)
              }
            />
          </label>
          <button
            className="icon-button"
            aria-label="Next calendar month"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={18} />
          </button>
          <button
            className="button"
            onClick={() =>
              onWindow(
                `${month}-01`,
                `${month}-${String(lastDay).padStart(2, "0")}`,
              )
            }
          >
            Select month
          </button>
        </div>
        <div className="month-calendar" aria-label="Season month calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span className="calendar-weekday" key={day}>
              {day}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: lastDay }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, "0")}`;
            const count = counts.get(date) || 0;
            return (
              <button
                key={date}
                aria-label={`${date}, ${count} games`}
                aria-pressed={date >= scope.from && date <= scope.to}
                className={
                  date >= scope.from && date <= scope.to ? "selected" : ""
                }
                onClick={() => onWindow(date, date)}
              >
                <strong>{i + 1}</strong>
                <small>{count ? `${count} games` : "No games"}</small>
              </button>
            );
          })}
        </div>
        <p className="research-footnote">
          {schedule.data?.reason ||
            (schedule.error
              ? "Schedule refresh unavailable; showing imported final games."
              : schedule.data
                ? `Schedule retrieved ${new Date(schedule.data.fetchedAt).toLocaleString()}.`
                : "Showing imported finals while the schedule loads.")}{" "}
          <button className="text-button" onClick={schedule.retry}>
            Refresh schedule
          </button>
        </p>
        <details className="hub-schedule">
          <summary>
            {selectedGames.length} scheduled, live or final games in this window
          </summary>
          <div className="hub-score-list">
            {selectedGames.map((game) => (
              <article key={game.id}>
                <span>
                  {game.date} ·{" "}
                  {game.status === "scheduled" && game.tipoff
                    ? new Date(game.tipoff).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : game.statusText || game.status}
                </span>
                <strong>
                  {game.away} {game.awayScore ?? ""} <span>at</span> {game.home}{" "}
                  {game.homeScore ?? ""}
                </strong>
                {game.status === "final" && (
                  <button
                    className="text-button"
                    onClick={() => setBoxId(game.id)}
                  >
                    Open box score
                  </button>
                )}
              </article>
            ))}
          </div>
          {!selectedGames.length && <p>No scheduled games in this window.</p>}
        </details>
      </section>
      <details className="panel research-panel">
        <summary className="hub-standings-summary">
          Standings for this date window
        </summary>
        <p>
          Win/loss record from imported finals; ordered by winning percentage,
          then point differential. This is a window summary, not official
          playoff seeding.
        </p>
        <div className="research-table-scroll">
          <table className="research-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>Win %</th>
                <th>Point differential</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team}>
                  <th scope="row">
                    {teams.find((team) => team.abbr === row.team)?.name}
                  </th>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>
                    {((row.wins / (row.wins + row.losses)) * 100).toFixed(1)}%
                  </td>
                  <td>{row.points - row.opponent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {boxId && <GameBoxScore id={boxId} onClose={() => setBoxId("")} />}
    </div>
  );
}
function GameBoxScore({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<{
    game?: Game;
    players?: {
      playerId: number;
      name: string;
      team: string;
      min: number;
      pts: number;
      reb: number;
      ast: number;
      fgm: number;
      fga: number;
      fg3m: number;
      fg3a: number;
      ftm: number;
      fta: number;
      tov: number;
    }[];
    error?: string;
  }>({});
  const [loadedId, setLoadedId] = useState("");
  // Read-only box-score fetch lives here, so unplayed games never become zero rows.
  useEffect(() => {
    const controller = new AbortController();
    setState({});
    fetch(`/api/games/${id}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail);
        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState(data);
          setLoadedId(id);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ error: error.message });
      });
    return () => controller.abort();
  }, [id]);
  return (
    <section className="panel research-panel" aria-label="Game box score">
      <div className="workbench-heading">
        <h2>
          {state.game
            ? `${state.game.away} ${state.game.awayScore} — ${state.game.home} ${state.game.homeScore}`
            : "Game box score"}
        </h2>
        <button className="button" onClick={onClose}>
          Close box score
        </button>
      </div>
      {state.error ? (
        <p role="alert">{state.error}</p>
      ) : loadedId !== id ? (
        <p role="status">Loading box score…</p>
      ) : (
        <div className="research-table-scroll">
          <table className="research-table">
            <thead>
              <tr>
                {[
                  "Player",
                  "Team",
                  "MIN",
                  "PTS",
                  "REB",
                  "AST",
                  "FG",
                  "3P",
                  "FT",
                  "TOV",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.players?.map((row) => (
                <tr key={row.playerId}>
                  <th scope="row">{row.name}</th>
                  <td>{row.team}</td>
                  <td>{row.min.toFixed(1)}</td>
                  <td>{row.pts}</td>
                  <td>{row.reb}</td>
                  <td>{row.ast}</td>
                  <td>
                    {row.fgm}/{row.fga}
                  </td>
                  <td>
                    {row.fg3m}/{row.fg3a}
                  </td>
                  <td>
                    {row.ftm}/{row.fta}
                  </td>
                  <td>{row.tov}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
