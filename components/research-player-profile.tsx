"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { players, type GameLog, type Player } from "@/lib/data";
import {
  metricById,
  metricFormat,
  type AnalysisMeta,
  type AnalysisRow,
  type AnalysisScope,
} from "@/lib/advanced";
import { PlayerAvatar } from "./player-avatar";
import { useAnalysis } from "./use-analysis";

interface Dashboard {
  player: Player;
  summary: AnalysisRow | null;
  logs: GameLog[];
  splits: Record<string, AnalysisRow | null>;
  meta: AnalysisMeta;
}
export function ResearchPlayerProfile({
  id,
  scope,
  onClose,
}: {
  id: number;
  scope: AnalysisScope;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const result = useAnalysis<Dashboard>(`players/${id}`, scope);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const player = result.data?.player || players.find((item) => item.id === id);
  const columns = ["gp", "min", "pts", "reb", "ast", "ts", "efg"];
  return (
    <dialog
      ref={dialog}
      className="profile-dialog"
      aria-labelledby="research-player-name"
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
            aria-label="Close player profile"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="profile-identity">
          <div>
            <h2 id="research-player-name">
              {player?.name || "Player profile"}
            </h2>
            <p>
              {scope.season} · {scope.seasonType} · {scope.split} ·{" "}
              {scope.mode.replaceAll("_", " ")}
            </p>
          </div>
          {player && <PlayerAvatar player={player} large />}
        </div>
        <p className="profile-provenance">
          {scope.start || "Season start"} –{" "}
          {scope.end || "Latest imported game"} · {scope.team || "All teams"} ·{" "}
          {result.data?.summary?.games ?? 0} eligible games
        </p>
        {result.loading && (
          <p role="status">Loading this player’s selected sample…</p>
        )}
        {result.error && (
          <div role="alert">
            <p>{result.error}</p>
            <button className="button" onClick={result.retry}>
              Retry player profile
            </button>
          </div>
        )}
        {result.data && (
          <>
            <div className="profile-stats">
              {["pts", "reb", "ast", "ts"].map((key) => (
                <div key={key}>
                  <span>{metricById[key].short}</span>
                  <strong>
                    {metricFormat(
                      result.data?.summary?.values[key],
                      metricById[key],
                    )}
                  </strong>
                </div>
              ))}
            </div>
            {!result.data.summary && (
              <p>
                No eligible summary in this scope. The recorded game log below
                remains available.
              </p>
            )}
            <h3>Performance splits</h3>
            <div className="research-table-scroll">
              <table className="research-table">
                <thead>
                  <tr>
                    <th>Split</th>
                    {columns.map((key) => (
                      <th key={key}>{metricById[key].short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.data.splits).map(([split, row]) => (
                    <tr key={split}>
                      <th scope="row">{split.replace("last", "Last ")}</th>
                      {columns.map((key) => (
                        <td key={key} title={row?.missing[key]}>
                          {metricFormat(row?.values[key], metricById[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Game log in the selected sample</h3>
            <div className="research-table-scroll">
              <table className="research-table">
                <thead>
                  <tr>
                    {[
                      "Date",
                      "Opponent",
                      "MIN",
                      "PTS",
                      "REB",
                      "AST",
                      "FG",
                      "3P",
                      "FT",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.logs.map((log) => (
                    <tr key={log.gameId}>
                      <th scope="row">{log.date}</th>
                      <td>
                        {log.home ? "vs" : "@"} {log.opponent}
                      </td>
                      <td>{log.min.toFixed(1)}</td>
                      <td>{log.pts}</td>
                      <td>{log.reb}</td>
                      <td>{log.ast}</td>
                      <td>
                        {log.fgm}/{log.fga}
                      </td>
                      <td>
                        {log.fg3m}/{log.fg3a}
                      </td>
                      <td>
                        {log.ftm}/{log.fta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-note">
              {result.data.meta.source.label} · Retrieved{" "}
              {new Date(result.data.meta.dataAsOf).toLocaleString()}. Split rows
              keep the selected date window and team; unsupported possession
              samples remain unavailable.
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
