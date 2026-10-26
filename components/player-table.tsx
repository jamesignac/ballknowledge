"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Plus,
  SearchX,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  format,
  metrics,
  type Metric,
  type PlayerStats,
} from "@/lib/analytics";
import { teams } from "@/lib/data";
import { PlayerAvatar } from "./player-avatar";

export function PlayerTable({
  rows,
  selected,
  onToggle,
  onPlayer,
  compact = false,
}: {
  rows: PlayerStats[];
  selected: number[];
  onToggle: (id: number) => void;
  onPlayer: (id: number) => void;
  compact?: boolean;
}) {
  const [sort, setSort] = useState<Metric | "gp">("pts");
  const [descending, setDescending] = useState(true);
  const [page, setPage] = useState(0);
  const populationKey = rows.map((row) => row.id).join(",");
  useEffect(() => setPage(0), [populationKey]);
  const pageSize = 50;
  const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const columns: (Metric | "gp")[] = compact
    ? ["gp", "pts", "reb", "ast", "ts"]
    : ["gp", "min", "pts", "reb", "ast", "stl", "blk", "fg", "three", "ts"];
  const sorted = [...rows].sort((a, b) => {
    if (!Number.isFinite(a[sort])) return 1;
    if (!Number.isFinite(b[sort])) return -1;
    return (a[sort] - b[sort]) * (descending ? -1 : 1);
  });
  function changeSort(key: Metric | "gp") {
    setPage(0);
    if (key === sort) setDescending(!descending);
    else {
      setSort(key);
      setDescending(true);
    }
  }
  return (
    <div>
      <div className="table-scroll">
        <table className="player-table">
          <caption className="sr-only">
            Player statistics in the current analysis scope. Column headers sort
            the table.
          </caption>
          <thead>
            <tr>
              <th className="rank-cell" scope="col">
                #
              </th>
              <th scope="col" className="name-cell">
                Player
              </th>
              <th scope="col">Team</th>
              {columns.map((key) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    sort === key
                      ? descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    onClick={() => changeSort(key)}
                    title={
                      key === "gp" ? "Games played" : metrics[key].definition
                    }
                  >
                    {key === "gp" ? "GP" : metrics[key].short}
                    {sort === key ? (
                      descending ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      )
                    ) : (
                      <ArrowUpDown size={11} className="sort-icon" />
                    )}
                  </button>
                </th>
              ))}
              <th scope="col" className="compare-cell">
                <span className="sr-only">Compare</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted
              .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
              .map((row, index) => (
                <tr
                  key={row.id}
                  className={selected.includes(row.id) ? "selected-row" : ""}
                >
                  <td className="rank-cell">
                    {String(currentPage * pageSize + index + 1).padStart(
                      2,
                      "0",
                    )}
                  </td>
                  <th scope="row" className="name-cell">
                    <button
                      className="player-link"
                      aria-label={`Open ${row.name} profile`}
                      onClick={() => onPlayer(row.id)}
                    >
                      <PlayerAvatar player={row} />
                      <span>
                        <strong>{row.name}</strong>
                        <small>
                          {row.position || "—"}
                          {row.number !== null && (
                            <>
                              <span>·</span> #{row.number}
                            </>
                          )}
                        </small>
                      </span>
                    </button>
                  </th>
                  <td>
                    <span className="team-tag">
                      <i
                        style={{
                          background: teams.find(
                            (team) => team.abbr === row.team,
                          )?.color,
                        }}
                      />
                      {row.team}
                    </span>
                  </td>
                  {columns.map((key) => (
                    <td
                      key={key}
                      className={`${key === sort ? "sorted-value" : ""} ${key === "ts" ? "efficiency-cell" : ""}`}
                    >
                      {key === "gp"
                        ? row.gp
                        : format(row[key], metrics[key].unit === "%")}
                    </td>
                  ))}
                  <td className="compare-cell">
                    <button
                      className={`compare-toggle ${selected.includes(row.id) ? "is-selected" : ""}`}
                      onClick={() => onToggle(row.id)}
                      aria-label={`${selected.includes(row.id) ? "Remove" : "Add"} ${row.name} ${selected.includes(row.id) ? "from" : "to"} comparison`}
                      aria-pressed={selected.includes(row.id)}
                    >
                      {selected.includes(row.id) ? (
                        <Check size={14} />
                      ) : (
                        <Plus size={14} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty-state">
            <SearchX size={32} />
            <h3>No players in this lineup.</h3>
            <p>Try another team, a wider date range, or fewer minimum games.</p>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="table-pagination">
          <span>
            Showing {currentPage * pageSize + 1}–
            {Math.min(rows.length, (currentPage + 1) * pageSize)} of{" "}
            {rows.length} players
          </span>
          <div>
            <button
              className="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Previous player page"
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {lastPage + 1}
            </span>
            <button
              className="button"
              disabled={currentPage === lastPage}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Next player page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
