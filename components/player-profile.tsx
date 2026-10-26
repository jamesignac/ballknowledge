"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { format, formatDataTime, type PlayerStats } from "@/lib/analytics";
import { players, teams, type SeasonMetadata } from "@/lib/data";
import { PlayerAvatar } from "./player-avatar";
import { useSmallScreen } from "./use-small-screen";
import { PlayerResearch } from "./player-research";
import type { Scope } from "@/lib/analytics";

export function PlayerProfile({
  id,
  metadata,
  scope,
  stats,
  selected,
  onClose,
  onToggle,
}: {
  id: number;
  metadata: SeasonMetadata;
  scope: Scope;
  stats?: PlayerStats;
  selected: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const compact = useSmallScreen();
  const player = stats || players.find((item) => item.id === id)!;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const logs = stats?.logs.slice(compact ? -6 : -12) || [];
  const chartWidth = compact ? 350 : 560;
  const stepWidth = compact ? 54 : 44;
  return (
    <dialog
      ref={dialog}
      className="profile-dialog"
      aria-labelledby="profile-name"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="profile-content">
        <div className="profile-top profile-close-row">
          <button
            autoFocus
            className="icon-button"
            onClick={onClose}
            aria-label="Close player profile"
          >
            <X size={20} />
          </button>
        </div>
        <div className="profile-identity">
          <div>
            <span className="team-tag">
              {player.team} · {player.position || "Position unavailable"}
              {player.number !== null ? ` · #${player.number}` : ""}
            </span>
            <h2 id="profile-name">{player.name}</h2>
            <p>
              {teams.find((team) => team.abbr === player.team)?.name} ·{" "}
              {player.height || "Height unavailable"}
            </p>
          </div>
          <PlayerAvatar player={player} large />
        </div>
        <button
          className={`button ${selected ? "secondary" : "primary"}`}
          onClick={onToggle}
        >
          {selected ? <Check size={16} /> : <Plus size={16} />}
          {selected ? "Added to comparison" : "Add to comparison"}
        </button>
        <p className="profile-provenance">
          NBA Stats ·{" "}
          {stats ? `${stats.gp} eligible games` : "No eligible sample"} · Data
          through {metadata.to}
        </p>
        {stats ? (
          <>
            <div className="profile-stats">
              {(["pts", "reb", "ast", "ts"] as const).map((key) => (
                <div key={key}>
                  <span>{key === "ts" ? "TS%" : key.toUpperCase()}</span>
                  <strong>{format(stats[key], key === "ts")}</strong>
                </div>
              ))}
            </div>
            <div className="profile-section-title">
              <h3>Scoring rhythm</h3>
              <span>Last {logs.length} games · points</span>
            </div>
            <div className={`trend-chart ${compact ? "compact-trend" : ""}`}>
              <svg
                viewBox={`0 0 ${chartWidth} 160`}
                role="img"
                aria-label={`${player.name}'s points in the last ${logs.length} games: ${logs.map((log) => log.pts).join(", ")}`}
              >
                <line
                  className="trend-baseline"
                  x1="15"
                  x2={chartWidth - 15}
                  y1="133"
                  y2="133"
                />
                {logs.map((log, i) => (
                  <g key={log.gameId}>
                    <rect
                      className="trend-bar"
                      x={20 + i * stepWidth}
                      y={
                        133 -
                        (log.pts /
                          Math.max(...logs.map((item) => item.pts), 1)) *
                          100
                      }
                      width="23"
                      height={
                        (log.pts /
                          Math.max(...logs.map((item) => item.pts), 1)) *
                        100
                      }
                      rx="3"
                    />
                    <text x={31 + i * stepWidth} y="154" textAnchor="middle">
                      {log.date.slice(5).replace("-", "/")}
                    </text>
                    <text
                      x={31 + i * stepWidth}
                      y={
                        124 -
                        (log.pts /
                          Math.max(...logs.map((item) => item.pts), 1)) *
                          100
                      }
                      textAnchor="middle"
                    >
                      {log.pts}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="profile-section-title">
              <h3>Game log</h3>
              <span>{stats.gp} games in selected window</span>
            </div>
            <div className="table-scroll">
              <table className="log-table">
                <thead>
                  <tr>
                    {["Date", "Opponent", "MIN", "PTS", "REB", "AST"].map(
                      (item) => (
                        <th key={item} scope="col">
                          {item}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...stats.logs].reverse().map((log) => (
                    <tr key={log.gameId}>
                      <td>{log.date.slice(5).replace("-", "/")}</td>
                      <th scope="row">
                        {log.home ? "vs" : "@"} {log.opponent}
                      </th>
                      <td>{format(log.min)}</td>
                      <td>
                        <strong>{log.pts}</strong>
                      </td>
                      <td>{log.reb}</td>
                      <td>{log.ast}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>No eligible sample in this scope.</h3>
            <p>
              Widen the date window or lower the minimum games to see this
              player’s stats.
            </p>
          </div>
        )}
        <details
          className="player-research-details"
          onToggle={(event) => setResearchOpen(event.currentTarget.open)}
        >
          <summary>Explore splits & career history</summary>
          {researchOpen && <PlayerResearch id={id} scope={scope} />}
        </details>
        <p className="panel-note">
          Source: {metadata.source.label}. Retrieved{" "}
          {formatDataTime(metadata.source.fetchedAt)}. Team labels reflect
          appearances in the selected window; missing roster details are not
          estimated.
        </p>
      </div>
    </dialog>
  );
}
