import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  aggregatePlayers,
  csvExport,
  defaultScope,
  parseScope,
  scopeParams,
  seasonBounds,
} from "../lib/analytics";
import { seasons } from "../lib/data";
import { parseSeasonData } from "../lib/season-data";
const entry = seasons.find((entry) => entry.id === "2024-25")!;
const data = parseSeasonData(
  JSON.parse(readFileSync(`public${entry.path}`, "utf8")),
  entry.id,
);
const scope = { ...defaultScope, season: entry.id, ...seasonBounds(entry.id) };

test("supported historical seasons include full player populations and 1,230 games", () => {
  for (const entry of seasons.filter((entry) => entry.complete)) {
    const season = parseSeasonData(
      JSON.parse(readFileSync(`public${entry.path}`, "utf8")),
      entry.id,
    );
    assert.ok(season.players.length > 550);
    assert.equal(season.games.length, 1230);
    assert.equal(
      new Set(season.games.flatMap((game) => [game.home, game.away])).size,
      30,
    );
  }
});
test("date windows include boundaries and recompute percentages from attempts", () => {
  const logs = data.gameLogs
    .filter((log) => log.playerId === 203999)
    .slice(0, 2);
  const row = aggregatePlayers(
    { ...scope, from: logs[0].date, to: logs[1].date },
    data,
  ).find((row) => row.id === 203999)!;
  assert.equal(row.gp, 2);
  assert.equal(row.pts, logs.reduce((sum, log) => sum + log.pts, 0) / 2);
  assert.equal(
    row.fg,
    (logs.reduce((sum, log) => sum + log.fgm, 0) /
      logs.reduce((sum, log) => sum + log.fga, 0)) *
      100,
  );
});
test("trade filters use game teams instead of current roster membership", () => {
  const all = aggregatePlayers(scope, data).find(
    (player) => player.id === 1629029,
  )!;
  const dallas = aggregatePlayers({ ...scope, team: "DAL" }, data).find(
    (player) => player.id === 1629029,
  )!;
  const lakers = aggregatePlayers({ ...scope, team: "LAL" }, data).find(
    (player) => player.id === 1629029,
  )!;
  assert.equal(all.team, "MULTI");
  assert.ok(dallas.gp > 0 && lakers.gp > 0);
  assert.equal(dallas.gp + lakers.gp, all.gp);
  assert.ok(dallas.logs.every((log) => log.team === "DAL"));
  assert.ok(lakers.logs.every((log) => log.team === "LAL"));
});
test("empty samples and missing metadata do not manufacture values", () => {
  assert.equal(
    aggregatePlayers({ ...scope, from: "2025-07-01", to: "2025-07-10" }, data)
      .length,
    0,
  );
  assert.equal(aggregatePlayers({ ...scope, minGames: 999 }, data).length, 0);
  const missing = data.players.find((player) => player.position === null)!;
  assert.ok(missing);
  assert.equal(
    aggregatePlayers(scope, data).find((player) => player.id === missing.id)
      ?.position,
    null,
  );
});
test("normalization uses precise minutes while preserving percentages", () => {
  const average = aggregatePlayers(scope, data).find(
    (player) => player.id === 203999,
  )!;
  const total = aggregatePlayers({ ...scope, perMode: "totals" }, data).find(
    (player) => player.id === 203999,
  )!;
  const per36 = aggregatePlayers({ ...scope, perMode: "per36" }, data).find(
    (player) => player.id === 203999,
  )!;
  assert.ok(Math.abs(total.pts - average.pts * average.gp) < 1e-8);
  assert.ok(Math.abs(per36.pts - (average.pts / average.min) * 36) < 1e-8);
  assert.equal(total.ts, average.ts);
});
test("shared scope round-trips and rejects malformed parameters", () => {
  const chosen = {
    ...scope,
    team: "DEN",
    position: "C",
    search: "jok",
    minGames: 25,
    x: "reb" as const,
    y: "ast" as const,
  };
  assert.deepEqual(parseScope(scopeParams(chosen)), chosen);
  const invalid = parseScope(
    new URLSearchParams(
      "season=garbage&minGames=-4&x=constructor&from=2025-99-99&team=FAKE&perMode=bad",
    ),
  );
  assert.equal(invalid.season, defaultScope.season);
  assert.equal(invalid.minGames, defaultScope.minGames);
  assert.equal(invalid.x, defaultScope.x);
  assert.equal(invalid.team, "ALL");
  assert.equal(invalid.from, defaultScope.from);
});
test("CSV records real source, coverage, refresh time, scope, and players", () => {
  const chosen = { ...scope, team: "DEN" };
  const csv = csvExport(aggregatePlayers(chosen, data), chosen, data.metadata);
  assert.ok(csv.includes("NBA Stats via nba_api"));
  assert.ok(csv.includes(data.metadata.source.fetchedAt));
  assert.ok(csv.includes("Nikola Joki\u0107"));
  assert.ok(csv.includes("player_id"));
  assert.ok(!csv.includes("Stephen Curry"));
  assert.ok(!csv.includes("Synthetic"));
});
test("snapshot validation rejects duplicates, unknown IDs, and invalid seasons", () => {
  assert.throws(
    () =>
      parseSeasonData(
        { ...data, gameLogs: [...data.gameLogs, data.gameLogs[0]] },
        entry.id,
      ),
    /validation/,
  );
  assert.throws(() => parseSeasonData(data, "2023-24"), /validation/);
  assert.throws(
    () =>
      parseSeasonData(
        {
          ...data,
          gameLogs: [
            { ...data.gameLogs[0], playerId: -1 },
            ...data.gameLogs.slice(1),
          ],
        },
        entry.id,
      ),
    /validation/,
  );
});

test("snapshot validation rejects impossible shooting counts", () => {
  const log = { ...data.gameLogs[0], fgm: data.gameLogs[0].fga + 1 };
  assert.throws(
    () =>
      parseSeasonData(
        { ...data, gameLogs: [log, ...data.gameLogs.slice(1)] },
        entry.id,
      ),
    /validation/,
  );
});
