"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { teams, type Game } from "@/lib/data";
import type { Scope } from "@/lib/analytics";

export function SeasonGames({ scope, games }: { scope: Scope; games: Game[] }) {
  const filtered = games.filter(
    (game) =>
      game.season === scope.season &&
      game.date >= scope.from &&
      game.date <= scope.to &&
      (scope.team === "ALL" ||
        game.home === scope.team ||
        game.away === scope.team),
  );
  const dates = [...new Set(filtered.map((game) => game.date))];
  const [chosen, setChosen] = useState("");
  const [offset, setOffset] = useState(0);
  const selected = dates.includes(chosen) ? chosen : dates[0];
  const visible = dates.slice(offset, offset + 7);
  const dayGames = filtered.filter((game) => game.date === selected);
  return (
    <section className="panel games-panel">
      <div className="panel-heading">
        <div>
          <h2>The daily slate</h2>
          <p>Completed NBA games in the selected season and date window.</p>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="date-strip">
        <button
          className="icon-button"
          aria-label="Previous game dates"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 7))}
        >
          <ChevronLeft size={18} />
        </button>
        {visible.map((date) => (
          <button
            key={date}
            className={`game-date ${selected === date ? "active" : ""}`}
            onClick={() => setChosen(date)}
          >
            <span>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                timeZone: "UTC",
              })}
            </span>
            <strong>{date.slice(8)}</strong>
            <span>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
                month: "short",
                timeZone: "UTC",
              })}
            </span>
          </button>
        ))}
        <button
          className="icon-button"
          aria-label="Next game dates"
          disabled={offset + 7 >= dates.length}
          onClick={() =>
            setOffset(Math.min(Math.max(0, dates.length - 7), offset + 7))
          }
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="game-grid">
        {dayGames.map((game) => (
          <article className="game-result" key={game.id}>
            <span className="final-label">FINAL · NBA</span>
            {[
              { abbr: game.away, score: game.awayScore },
              { abbr: game.home, score: game.homeScore },
            ].map((team) => (
              <div key={team.abbr}>
                <span
                  className="team-monogram"
                  style={{
                    color: teams.find((item) => item.abbr === team.abbr)?.color,
                  }}
                >
                  {team.abbr}
                </span>
                <span>
                  {teams.find((item) => item.abbr === team.abbr)?.name}
                </span>
                <strong
                  className={
                    team.score === Math.max(game.homeScore, game.awayScore)
                      ? "winner"
                      : ""
                  }
                >
                  {team.score}
                </strong>
              </div>
            ))}
          </article>
        ))}
      </div>
      {!dayGames.length && (
        <div className="empty-state">
          <CalendarDays size={32} />
          <h3>No games in this window.</h3>
          <p>Choose another season or widen your date range.</p>
        </div>
      )}
    </section>
  );
}
