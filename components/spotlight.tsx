import { ArrowUpRight, Plus, Check } from "lucide-react";
import type { PlayerStats } from "@/lib/analytics";
import { format } from "@/lib/analytics";
import { teams } from "@/lib/data";
import { PlayerAvatar } from "./player-avatar";

export function Spotlight({
  player,
  selected,
  onPlayer,
  onToggle,
}: {
  player: PlayerStats;
  selected: boolean;
  onPlayer: () => void;
  onToggle: () => void;
}) {
  const parts = player.name.split(" ");
  return (
    <section className="spotlight" aria-label="Player spotlight">
      <div className="spotlight-top">
        <span>
          <span className="live-dot" />
        </span>
        <span>
          {player.team} <span className="slash">/</span>{" "}
          {player.position || "?"}
        </span>
      </div>
      <div className="spotlight-identity">
        <div>
          <p className="spotlight-first">{parts.slice(0, -1).join(" ")}</p>
          <h2>{parts.at(-1)}</h2>
          <p className="spotlight-team">
            {teams.find((team) => team.abbr === player.team)?.name ||
              "Multiple teams"}
          </p>
        </div>
        <span className="jersey-number" aria-hidden="true">
          {player.number}
        </span>
        <PlayerAvatar player={player} large />
      </div>
      <div className="spotlight-stats">
        {(["pts", "reb", "ast"] as const).map((key) => (
          <div key={key}>
            <strong>{format(player[key])}</strong>
            <span>{key.toUpperCase()}</span>
          </div>
        ))}
      </div>
      <div className="spotlight-actions">
        <button onClick={onPlayer}>
          Explore player <ArrowUpRight size={16} />
        </button>
        <button
          className={selected ? "active" : ""}
          onClick={onToggle}
          aria-label={`${selected ? "Remove" : "Add"} spotlight player ${selected ? "from" : "to"} comparison`}
        >
          {selected ? <Check size={16} /> : <Plus size={16} />}
        </button>
      </div>
    </section>
  );
}
