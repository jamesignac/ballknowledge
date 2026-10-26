"use client";
import { useState } from "react";
type ShotRow = Record<string, string | number | null>;
const zones = [
  { id: "ra", name: "Restricted area", x: 250, y: 90 },
  { id: "paint", name: "Other paint", x: 250, y: 170 },
  { id: "mid", name: "Mid-range", x: 120, y: 220 },
  { id: "leftCorner", name: "Left corner 3", x: 46, y: 105 },
  { id: "rightCorner", name: "Right corner 3", x: 454, y: 105 },
  { id: "aboveBreak", name: "Above-break 3", x: 320, y: 310 },
  { id: "backcourt", name: "Backcourt", x: 125, y: 385 },
];
export function ScoringCourt({ rows }: { rows: ShotRow[] }) {
  const [selected, setSelected] = useState("");
  const row =
    rows.find((item) => String(item.PLAYER_ID) === selected) || rows[0];
  if (!row) return null;
  const attempts = zones.reduce(
    (total, zone) => total + Number(row[zone.id + ":attempts"] || 0),
    0,
  );
  return (
    <div className="scoring-court-section">
      <label>
        Player scoring profile
        <select
          aria-label="Player scoring profile"
          value={String(row.PLAYER_ID)}
          onChange={(event) => setSelected(event.target.value)}
        >
          {rows.map((item) => (
            <option key={String(item.PLAYER_ID)} value={String(item.PLAYER_ID)}>
              {item.PLAYER_NAME} · {item.TEAM_ABBREVIATION}
            </option>
          ))}
        </select>
      </label>
      <div className="scoring-court-layout">
        <svg
          viewBox="0 0 500 430"
          role="img"
          aria-label={`${row.PLAYER_NAME}: ${attempts} field-goal attempts across strict NBA shot zones`}
        >
          <rect
            x="15"
            y="15"
            width="470"
            height="400"
            fill="#f6f6f2"
            stroke="#b8c2af"
          />
          <path
            d="M185 15v180h130V15M30 15v138a230 230 0 0 0 440 0V15M15 355h470"
            fill="none"
            stroke="#b8c2af"
          />
          <circle cx="250" cy="60" r="8" fill="none" stroke="#476b4c" />
          <path
            d="M225 45h50M215 60a35 35 0 0 0 70 0"
            fill="none"
            stroke="#476b4c"
          />
          {zones.map((zone) => {
            const count = Number(row[zone.id + ":attempts"] || 0),
              fg = row[zone.id + ":fg"];
            return (
              <g key={zone.id}>
                <circle
                  cx={zone.x}
                  cy={zone.y}
                  r={Math.sqrt(attempts ? count / attempts : 0) * 65}
                  fill="#476b4c"
                  fillOpacity=".14"
                />
                <text
                  x={zone.x}
                  y={zone.y - 3}
                  textAnchor="middle"
                  fill="#24362e"
                  fontSize="15"
                  fontWeight="700"
                >
                  {count} FGA
                </text>
                <text
                  x={zone.x}
                  y={zone.y + 14}
                  textAnchor="middle"
                  fill="#47564b"
                  fontSize="10"
                >
                  {count && typeof fg === "number"
                    ? `${(fg * 100).toFixed(1)}% FG`
                    : "No attempts"}
                </text>
                <title>
                  {zone.name}: {count} attempts;{" "}
                  {attempts ? ((count / attempts) * 100).toFixed(1) : 0}% of
                  attempts
                </title>
              </g>
            );
          })}
        </svg>
        <div>
          <h3>{row.PLAYER_NAME}</h3>
          <p>
            Schematic zone map, with {attempts} recorded attempts. Circle area
            reflects shot frequency; labels show volume and accuracy. These are
            zone aggregates, not shot coordinates.
          </p>
          <dl>
            {zones.map((zone) => {
              const count = Number(row[zone.id + ":attempts"] || 0);
              return (
                <div key={zone.id}>
                  <dt>{zone.name}</dt>
                  <dd>
                    {attempts ? ((count / attempts) * 100).toFixed(1) : "—"}% of
                    attempts
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </div>
  );
}
