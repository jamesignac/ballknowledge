import { type SeasonData, type SeasonMetadata } from "./data";

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const stats = [
  "min",
  "pts",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
];

/** The only browser data boundary. Invalid snapshots never fall back to demo data. */
export function parseSeasonData(value: unknown, season: string): SeasonData {
  const fail = () => {
    throw new Error(
      "The season snapshot failed validation. Refresh the data and retry.",
    );
  };
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !record(value.metadata) ||
    value.metadata.id !== season ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.games) ||
    !Array.isArray(value.gameLogs)
  )
    return fail();
  const metadata = value.metadata;
  if (
    !record(metadata.source) ||
    typeof metadata.source.label !== "string" ||
    typeof metadata.source.fetchedAt !== "string" ||
    !Array.isArray(metadata.source.urls) ||
    !metadata.source.urls.every(
      (url) => typeof url === "string" && url.startsWith("https://"),
    ) ||
    typeof metadata.from !== "string" ||
    typeof metadata.to !== "string"
  )
    return fail();
  const playerIds = new Set<number>();
  for (const player of value.players) {
    if (
      !record(player) ||
      !finite(player.id) ||
      !Number.isInteger(player.id) ||
      typeof player.name !== "string" ||
      !player.name ||
      typeof player.team !== "string" ||
      (player.position !== null && typeof player.position !== "string") ||
      (player.number !== null &&
        typeof player.number !== "string" &&
        typeof player.number !== "number") ||
      (player.age !== null && !finite(player.age)) ||
      (player.height !== null && typeof player.height !== "string") ||
      playerIds.has(player.id)
    )
      return fail();
    playerIds.add(player.id);
  }
  const gameIds = new Map<string, Record<string, unknown>>();
  for (const game of value.games) {
    if (
      !record(game) ||
      typeof game.id !== "string" ||
      !/^002\d{7}$/.test(game.id) ||
      gameIds.has(game.id) ||
      game.season !== season ||
      typeof game.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(game.date) ||
      typeof game.home !== "string" ||
      typeof game.away !== "string" ||
      game.home === game.away ||
      !finite(game.homeScore) ||
      !finite(game.awayScore)
    )
      return fail();
    gameIds.set(game.id, game);
  }
  const appearances = new Set<string>();
  const teamPoints = new Map<string, number>();
  for (const log of value.gameLogs) {
    if (
      !record(log) ||
      !finite(log.playerId) ||
      !playerIds.has(log.playerId) ||
      typeof log.gameId !== "string" ||
      log.season !== season ||
      typeof log.home !== "boolean" ||
      !stats.every((key) => finite(log[key]))
    )
      return fail();
    const game = gameIds.get(log.gameId);
    // All stat fields were checked as finite nonnegative numbers above.
    const count = (key: string) => log[key] as number;
    if (
      count("fgm") > count("fga") ||
      count("fg3m") > count("fg3a") ||
      count("ftm") > count("fta") ||
      count("fg3m") > count("fgm") ||
      count("fg3a") > count("fga") ||
      count("pts") !== 2 * count("fgm") + count("fg3m") + count("ftm")
    )
      return fail();
    const key = `${log.gameId}:${log.playerId}`;
    if (
      !game ||
      log.date !== game.date ||
      log.team !== (log.home ? game.home : game.away) ||
      log.opponent !== (log.home ? game.away : game.home) ||
      appearances.has(key)
    )
      return fail();
    appearances.add(key);
    const teamKey = `${log.gameId}:${log.team}`;
    teamPoints.set(teamKey, (teamPoints.get(teamKey) || 0) + count("pts"));
  }
  for (const [id, game] of gameIds) {
    if (
      teamPoints.get(`${id}:${game.home}`) !== game.homeScore ||
      teamPoints.get(`${id}:${game.away}`) !== game.awayScore
    )
      return fail();
  }
  if (
    metadata.playerCount !== playerIds.size ||
    metadata.gameCount !== gameIds.size ||
    metadata.appearanceCount !== appearances.size
  )
    return fail();
  return value as unknown as SeasonData;
}

export async function loadSeasonData(
  season: string,
  signal?: AbortSignal,
): Promise<SeasonData> {
  const manifestResponse = await fetch("/data/manifest.json", {
    signal,
    cache: "no-store",
  });
  if (!manifestResponse.ok)
    throw new Error(
      "The current data manifest could not be loaded. Check the analytics API and retry.",
    );
  const manifest: unknown = await manifestResponse.json();
  if (!record(manifest) || !Array.isArray(manifest.seasons))
    throw new Error("The current data manifest failed validation.");
  const entry = manifest.seasons.find(
    (item: unknown) => record(item) && item.id === season,
  ) as SeasonMetadata | undefined;
  if (
    !entry?.path ||
    !/^\/data\/\d{4}-\d{2}-[a-f0-9]{12}\.json$/.test(entry.path)
  )
    throw new Error(
      "This season has not been imported yet. Choose an available season.",
    );
  const response = await fetch(entry.path, { signal });
  if (!response.ok)
    throw new Error(
      "The season snapshot could not be loaded. Check your connection and retry.",
    );
  const text = await response.text();
  if (text.length > 15_000_000)
    throw new Error("The season snapshot exceeds the supported size.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "The season snapshot could not be read. Refresh the data and retry.",
    );
  }
  return parseSeasonData(parsed, season);
}
