"use client";

import { ArrowLeftRight, Plus, X } from "lucide-react";
import {
  format,
  metrics,
  type Metric,
  type PlayerStats,
} from "@/lib/analytics";
import { players } from "@/lib/data";
import { PlayerAvatar } from "./player-avatar";
import { useRef } from "react";

export function Comparison({
  selected,
  rows,
  onToggle,
  onExplore,
}: {
  selected: number[];
  rows: PlayerStats[];
  onToggle: (id: number) => void;
  onExplore: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const chosen = selected
    .map((id) => ({
      player:
        rows.find((player) => player.id === id) ||
        players.find((player) => player.id === id)!,
      stats: rows.find((row) => row.id === id),
    }))
    .filter((item) => item.player);
  const keys: Metric[] = [
    "pts",
    "reb",
    "ast",
    "ts",
    "fg",
    "three",
    "stl",
    "blk",
    "min",
  ];
  if (!chosen.length)
    return (
      <section className="panel empty-state comparison-empty">
        <ArrowLeftRight size={40} />
        <h2>Great players. Different stories.</h2>
        <p>
          Choose up to four players from the explorer to see where their games
          overlap—and where they stand apart.
        </p>
        <button className="button primary" onClick={onExplore}>
          <Plus size={16} />
          Find players to compare
        </button>
      </section>
    );
  return (
    <section className="panel comparison-panel">
      <div className="comparison-instructions">
        <span>
          <span className="orange-dot" />
          Best value in this comparison
        </span>
        <button className="text-button" onClick={onExplore}>
          <Plus size={14} />
          Add a player
        </button>
      </div>
      <div className="mobile-comparison-guide">
        <strong>{chosen.length} players selected</strong>
        <span>{chosen.map((item) => item.player.name).join(" / ")}</span>
        {chosen.length > 2 && (
          <button
            className="text-button"
            onClick={() =>
              scroll.current?.scrollBy({ left: 200, behavior: "smooth" })
            }
          >
            Swipe or tap to see more players →
          </button>
        )}
      </div>
      <div className="table-scroll" ref={scroll}>
        <table className={`comparison-table compare-${chosen.length}`}>
          <caption className="sr-only">
            Side-by-side comparison of selected players in the current scope.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                The breakdown<span>Same scope. Every player.</span>
              </th>
              {chosen.map(({ player, stats }) => (
                <th key={player.id} scope="col">
                  <div className="comparison-player">
                    <button
                      className="icon-button remove-player"
                      aria-label={`Remove ${player.name} from comparison`}
                      onClick={() => onToggle(player.id)}
                    >
                      <X size={16} />
                    </button>
                    <PlayerAvatar player={player} large />
                    <strong>{player.name}</strong>
                    <span>
                      {player.team} · {player.position} ·{" "}
                      {stats ? `${stats.gp} GP` : "No eligible sample"}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const finite = chosen.flatMap((item) =>
                item.stats && Number.isFinite(item.stats[key])
                  ? [item.stats[key]]
                  : [],
              );
              const best = Math.max(...finite);
              return (
                <tr key={key}>
                  <th scope="row" title={metrics[key].definition}>
                    {metrics[key].label}
                    <small>{metrics[key].unit || "count"}</small>
                  </th>
                  {chosen.map(({ player, stats }) => (
                    <td
                      key={player.id}
                      className={
                        stats && stats[key] === best ? "best-value" : ""
                      }
                    >
                      {stats
                        ? format(stats[key], metrics[key].unit === "%")
                        : "—"}
                      {stats && stats[key] === best && (
                        <span className="sr-only">, best in comparison</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="panel-note">
        Higher values are highlighted for descriptive comparison; they do not
        imply a better overall player. NBA Stats snapshot.
      </p>
    </section>
  );
}
