"""Scope, normalization and missingness guarantees for the production analytics API."""

import unittest
from unittest.mock import patch
from services.api.app.contracts import CATALOG, Scope, StatsQuery
from services.api.app.analytics import aggregate, percentile_values, on_off_rows
from services.api.app.providers import fetch


def log(player, game, pts, fga, fgm, **extra):
    return {
        "playerId": player,
        "gameId": str(game),
        "date": f"2026-10-{20 + game:02}",
        "team": "BOS",
        "home": True,
        "opponent": "NYK",
        "min": 30,
        "pts": pts,
        "fga": fga,
        "fgm": fgm,
        "fg3m": 0,
        "fg3a": 0,
        "ftm": 0,
        "fta": 0,
        "reb": 4,
        "ast": 2,
        "tov": 1,
        "stl": 0,
        "blk": 0,
        **extra,
    }


class AnalyticsContractTests(unittest.TestCase):
    def setUp(self):
        self.players = {
            1: {"id": 1, "name": "One", "position": "G"},
            2: {"id": 2, "name": "Two", "position": "F"},
        }
        self.logs = [log(1, 1, 2, 1, 1), log(1, 2, 2, 9, 1), log(2, 1, 10, 10, 5)]
        self.games = {}

    def rows(self, scope=None, provider=None):
        return aggregate(
            self.logs,
            self.players,
            self.games,
            scope or Scope(),
            ["pts", "fg", "ts", "rts", "oreb", "dpm", "usage"],
            provider or {},
        )

    def test_ratios_use_summed_components(self):
        one = self.rows()[0]
        self.assertEqual(one["values"]["fg"], 20)
        self.assertEqual(one["values"]["pts"], 2)
        self.assertIsNone(one["values"]["oreb"])
        self.assertIsNone(one["values"]["dpm"])

    def test_possession_modes_require_matched_provider_sample(self):
        one = self.rows(
            Scope(mode="per100"),
            {
                "advanced": {
                    "rows": [{"PLAYER_ID": 1, "GP": 1, "POSS": 100, "USG_PCT": 0.2}]
                }
            },
        )[0]
        self.assertIsNone(one["values"]["pts"])
        self.assertIsNone(one["values"]["usage"])
        self.assertIn("sample", one["missing"]["pts"])

    def test_per100_uses_actual_possessions_and_percentages_stay(self):
        one = self.rows(
            Scope(mode="per100"),
            {
                "advanced": {
                    "rows": [{"PLAYER_ID": 1, "GP": 2, "POSS": 125, "USG_PCT": 0.2}]
                }
            },
        )[0]
        self.assertAlmostEqual(one["values"]["pts"], 3.2)
        self.assertEqual(one["values"]["fg"], 20)
        self.assertEqual(one["values"]["usage"], 20)

    def test_relative_ts_baseline_ignores_team_eligibility(self):
        self.assertEqual(
            self.rows()[0]["values"]["rts"],
            self.rows(Scope(minGames=2))[0]["values"]["rts"],
        )

    def test_last_n_is_per_player_within_window(self):
        rows = self.rows(Scope(split="last5", start="2026-10-22"))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["values"]["pts"], 2)

    def test_percentiles_share_tie_rank_and_reverse_lower_better(self):
        self.assertEqual(percentile_values([1, 1, 3], True), [25, 25, 100])
        self.assertEqual(percentile_values([1, 1, 3], False), [75, 75, 0])

    def test_catalog_and_bounded_contract(self):
        self.assertGreaterEqual(len(CATALOG["metrics"]), 250)
        self.assertEqual(
            len(CATALOG["metrics"]), len({m["id"] for m in CATALOG["metrics"]})
        )
        with self.assertRaises(ValueError):
            StatsQuery(metrics=["unknown"])
        with self.assertRaises(ValueError):
            Scope(start="2026-10-25", end="2026-10-01")

    def test_unverifiable_last_n_aggregate_feed_is_explicitly_unavailable(self):
        result = fetch("advanced", Scope(split="last5"))
        self.assertEqual(result["rows"], [])
        self.assertIn("last-N", result["reason"])

    def test_on_off_difference_requires_observed_off_court_minutes(self):
        tables = [
            {
                "name": "PlayersOnCourtSummary",
                "rows": [{"VS_PLAYER_ID": 1, "MIN": 100, "NET_RATING": 5}],
            },
            {
                "name": "PlayersOffCourtSummary",
                "rows": [{"VS_PLAYER_ID": 1, "MIN": 0, "NET_RATING": 0}],
            },
        ]
        self.assertIsNone(on_off_rows(tables)[0]["ON_OFF_NET"])
        tables[1]["rows"][0].update({"MIN": 80, "NET_RATING": -2})
        self.assertEqual(on_off_rows(tables)[0]["ON_OFF_NET"], 7)

    def test_defending_adapter_obeys_installed_endpoint_contract(self):
        with patch(
            "nba_api.stats.endpoints.leaguedashptdefend.LeagueDashPtDefend",
            autospec=True,
        ) as endpoint:
            endpoint.return_value.get_dict.return_value = {
                "resultSets": [
                    {
                        "name": "Defend",
                        "headers": ["CLOSE_DEF_PERSON_ID", "GP", "D_FGA", "D_FG_PCT"],
                        "rowSet": [[1, 2, 3, 0.333]],
                    }
                ]
            }
            result = fetch("defend", Scope(start="2026-10-20", end="2026-10-25"))
            self.assertEqual(result["rows"][0]["CLOSE_DEF_PERSON_ID"], 1)
            self.assertEqual(endpoint.call_args.kwargs["last_n_games_nullable"], "0")
            self.assertEqual(
                endpoint.call_args.kwargs["date_from_nullable"], "10/20/2026"
            )

    def test_clutch_counts_use_clutch_denominators(self):
        provider = {
            "clutch": {"rows": [{"PLAYER_ID": 1, "GP": 1, "MIN": 5, "PTS": 6}]},
            "advanced": {"rows": [{"PLAYER_ID": 1, "GP": 2, "POSS": 125}]},
        }
        rows = aggregate(
            self.logs, self.players, self.games, Scope(), ["clutchPts"], provider
        )
        self.assertEqual(rows[0]["values"]["clutchPts"], 6)
        rows = aggregate(
            self.logs,
            self.players,
            self.games,
            Scope(mode="per100"),
            ["clutchPts"],
            provider,
        )
        self.assertIsNone(rows[0]["values"]["clutchPts"])
        self.assertIn("Clutch possession", rows[0]["missing"]["clutchPts"])


if __name__ == "__main__":
    unittest.main()
