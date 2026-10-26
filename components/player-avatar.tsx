import type { Player } from "@/lib/data";
import localHeadshots from "../public/players/index.json";

export function PlayerAvatar({
  player,
  large = false,
}: {
  player: Player;
  large?: boolean;
}) {
  return (
    <span
      className={`player-avatar ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <span className="avatar-fallback">
        {player.name
          .split(" ")
          .map((word) => word[0])
          .slice(0, 2)
          .join("")}
      </span>
      {/* Local NBA headshots; initials remain visible if an asset cannot load. */}
      <img
        src={
          localHeadshots.includes(player.id)
            ? `/players/${player.id}.png`
            : `https://cdn.nba.com/headshots/nba/latest/260x190/${player.id}.png`
        }
        alt=""
        width={large ? 180 : 64}
        height={large ? 132 : 48}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}
