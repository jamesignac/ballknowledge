"use client";
import { useEffect, useState } from "react";
import type { Player } from "@/lib/data";
import { players as playerCatalog } from "@/lib/data";
import { downloadFile } from "@/lib/advanced";
const tiers = ["S", "A", "B", "C", "Watch list"];
type Board = Record<string, number[]>;
const empty = () =>
  Object.fromEntries(tiers.map((tier) => [tier, [] as number[]]));
export function Rankings({
  players,
  season,
}: {
  players: Player[];
  season: string;
}) {
  const [board, setBoard] = useState<Board>(empty);
  const [loadedSeason, setLoadedSeason] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const valid = empty();
    try {
      const saved = JSON.parse(
        localStorage.getItem(`ballknowledge:rankings:${season}`) || "null",
      );
      const seen = new Set<number>();
      if (saved && typeof saved === "object") {
        for (const tier of tiers) {
          valid[tier] = (Array.isArray(saved[tier]) ? saved[tier] : []).filter(
            (id: unknown) => {
              if (
                typeof id !== "number" ||
                !playerCatalog.some((p) => p.id === id) ||
                seen.has(id)
              )
                return false;
              seen.add(id);
              return true;
            },
          );
        }
      }
    } catch {
      setMessage("Saved board could not load. You can start a new board.");
    }
    setBoard(valid);
    setLoadedSeason(season);
  }, [season]);
  useEffect(() => {
    if (loadedSeason !== season) return;
    try {
      localStorage.setItem(
        `ballknowledge:rankings:${season}`,
        JSON.stringify(board),
      );
    } catch {
      setMessage(
        "Browser storage is unavailable. Export the board to keep it.",
      );
    }
  }, [board, loadedSeason, season]);
  function move(id: number, tier: string) {
    setBoard((previous) => {
      const next = Object.fromEntries(
        tiers.map((key) => [key, previous[key].filter((item) => item !== id)]),
      );
      if (tier) next[tier].push(id);
      return next;
    });
  }
  function exportBoard() {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [["season", "tier", "player_id", "player"].join(",")];
    for (const tier of tiers)
      for (const id of board[tier])
        rows.push(
          [
            season,
            quote(tier),
            String(id),
            quote(
              playerCatalog.find((player) => player.id === id)?.name ||
                String(id),
            ),
          ].join(","),
        );
    downloadFile(
      new Blob([rows.join("\r\n")], { type: "text/csv" }),
      `ballknowledge-rankings-${season}.csv`,
    );
  }
  const assigned = new Set(Object.values(board).flat());
  const available = players.filter(
    (player) =>
      !assigned.has(player.id) &&
      player.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="panel research-panel">
      <div className="workbench-heading">
        <div>
          <h2>Your calls. Your tiers.</h2>
          <p>
            Rank players in the selected sample. Boards save in this browser by
            season.
          </p>
        </div>
        <button className="button" onClick={exportBoard}>
          Export rankings CSV
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="ranking-board">
        {tiers.map((tier) => (
          <section
            key={tier}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = Number(event.dataTransfer.getData("text/plain"));
              if (players.some((player) => player.id === id)) move(id, tier);
            }}
          >
            <h3>{tier}</h3>
            <div>
              {board[tier].map((id) => (
                <article
                  key={id}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData("text/plain", String(id))
                  }
                >
                  <strong>
                    {playerCatalog.find((player) => player.id === id)?.name}
                  </strong>
                  <label>
                    <span className="sr-only">
                      Move{" "}
                      {playerCatalog.find((player) => player.id === id)?.name}{" "}
                      to tier
                    </span>
                    <select
                      value={tier}
                      onChange={(event) => move(id, event.target.value)}
                    >
                      <option value="">Unranked</option>
                      {tiers.map((key) => (
                        <option key={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
              {!board[tier].length && (
                <p>Drop a player here, or use their tier selector.</p>
              )}
            </div>
          </section>
        ))}
      </div>
      <label className="ranking-search">
        Find an unranked player
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player names…"
        />
      </label>
      <p>{available.length} unranked players · showing up to 30 matches</p>
      <div className="ranking-unassigned">
        {available.slice(0, 30).map((player) => (
          <label key={player.id}>
            {player.name}
            <select
              aria-label={`Assign ${player.name} to tier`}
              value=""
              onChange={(event) => move(player.id, event.target.value)}
            >
              <option value="">Choose tier</option>
              {tiers.map((tier) => (
                <option key={tier}>{tier}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
