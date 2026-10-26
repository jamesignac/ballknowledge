"use client";
import { useAnalysis } from "./use-analysis";
import type { AnalysisScope } from "@/lib/advanced";
import type { Game } from "@/lib/data";
export function PostseasonExplorer({ scope }: { scope: AnalysisScope }) {
  const result = useAnalysis<{ games: Game[] }>("games", {
    ...scope,
    seasonType: "Playoffs",
  });
  const series = new Map<
    string,
    { round: number; teams: Map<string, number>; games: Game[] }
  >();
  for (const game of result.data?.games || []) {
    const key = game.id.slice(0, 9);
    const group = series.get(key) || {
      round: Number(game.id[7]),
      teams: new Map<string, number>(),
      games: [],
    };
    group.games.push(game);
    for (const team of [game.home, game.away])
      group.teams.set(team, group.teams.get(team) || 0);
    const winner = game.homeScore > game.awayScore ? game.home : game.away;
    group.teams.set(winner, (group.teams.get(winner) || 0) + 1);
    series.set(key, group);
  }
  return (
    <section className="panel research-panel">
      <h2>The path through the playoffs</h2>
      <p>
        Series grouped by official NBA game IDs. Series records reflect only
        games inside this window; choose the full postseason for complete
        records.
      </p>
      {result.loading && <p role="status">Loading postseason games…</p>}
      {result.error && (
        <div role="alert">
          <p>{result.error}</p>
          <button className="button" onClick={result.retry}>
            Retry playoffs
          </button>
        </div>
      )}
      <div className="playoff-rounds">
        {[1, 2, 3, 4].map((round) => (
          <section key={round}>
            <h3>
              {
                [
                  "",
                  "First round",
                  "Conference semifinals",
                  "Conference finals",
                  "NBA Finals",
                ][round]
              }
            </h3>
            {[...series.entries()]
              .filter(([, group]) => group.round === round)
              .map(([key, group]) => (
                <details key={key}>
                  <summary>
                    {[...group.teams]
                      .map(([team, wins]) => `${team} ${wins}`)
                      .join(" — ")}
                  </summary>
                  {group.games.map((game) => (
                    <p key={game.id}>
                      {game.date}
                      <br />
                      {game.away} {game.awayScore} at {game.home}{" "}
                      {game.homeScore}
                    </p>
                  ))}
                </details>
              ))}
          </section>
        ))}
      </div>
      {result.data && !result.data.games.length && (
        <p>No imported playoff games in this scope.</p>
      )}
    </section>
  );
}
