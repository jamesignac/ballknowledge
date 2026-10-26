"""Exercise migrated SQL storage and public HTTP contracts without NBA network I/O."""

import json
import os
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from services.api.app.database import Appearance, ROOT, connect
from services.api.app.import_data import import_snapshots
from services.api.app.main import create_app
from services.api.app.migrate import migrate


class APIIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cls.url = os.environ.get(
            "TEST_DATABASE_URL",
            f"sqlite:///{Path(cls.directory.name) / 'integration.sqlite'}",
        )
        cls.engine, cls.sessions = connect(cls.url)
        migrate(cls.engine)
        import_snapshots(cls.sessions)
        import_snapshots(cls.sessions, ROOT / "public/data/playoffs")
        cls.app = create_app(cls.url, initialize=False)
        cls.client = TestClient(cls.app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls.engine.dispose()
        cls.directory.cleanup()

    def setUp(self):
        self.app.state.providers.get = lambda *args, **kwargs: {
            "rows": [],
            "reason": "Test source unavailable",
            "fetchedAt": "2026-10-25T00:00:00Z",
        }

    def test_health_and_season_types(self):
        self.assertEqual(self.client.get("/api/health").json()["status"], "ok")
        seasons = self.client.get("/api/seasons").json()
        self.assertEqual(set(seasons["seasonTypes"]), {"Playoffs", "Regular Season"})
        self.assertEqual(len(seasons["seasons"]), 7)
        manifest = self.client.get("/api/snapshots/manifest.json").json()
        self.assertEqual(len(manifest["seasons"]), 4)
        snapshot = self.client.get(
            "/api/snapshots/" + Path(manifest["seasons"][0]["path"]).name
        )
        self.assertEqual(snapshot.status_code, 200)
        self.assertIn("immutable", snapshot.headers["cache-control"])

    def test_full_population_and_untruncated_export(self):
        query = {
            "scope": {"season": "2024-25"},
            "metrics": ["pts", "fg", "dpm"],
            "limit": 50,
        }
        result = self.client.post("/api/stats", json=query).json()
        self.assertEqual(result["total"], 569)
        self.assertEqual(len(result["rows"]), 50)
        self.assertIsNone(result["rows"][0]["values"]["dpm"])
        exported = self.client.post("/api/export", json=query)
        self.assertEqual(exported.status_code, 200)
        self.assertIn("# rows,569,matching,569", exported.text)
        self.assertIn("Unavailable: no validated model", exported.text)

    def test_search_and_metric_filters_preserve_percentile_cohort(self):
        query = {
            "scope": {"season": "2024-25"},
            "metrics": ["pts", "ts"],
            "search": "jokic",
            "filters": [{"metric": "pts", "op": "gte", "value": 20}],
        }
        result = self.client.post("/api/stats", json=query).json()
        self.assertEqual(result["cohortSize"], 569)
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["rows"][0]["player"]["id"], 203999)

    def test_game_box_and_playoffs_do_not_mix(self):
        regular = self.client.post("/api/games", json={"season": "2024-25"}).json()[
            "games"
        ]
        playoffs = self.client.post(
            "/api/games", json={"season": "2024-25", "seasonType": "Playoffs"}
        ).json()["games"]
        self.assertEqual(len(regular), 1230)
        self.assertEqual(len(playoffs), 84)
        self.assertTrue(all(g["id"].startswith("004") for g in playoffs))
        box = self.client.get("/api/games/" + playoffs[0]["id"]).json()
        for team, score in [
            (box["game"]["home"], box["game"]["homeScore"]),
            (box["game"]["away"], box["game"]["awayScore"]),
        ]:
            self.assertEqual(
                sum(p["pts"] for p in box["players"] if p["team"] == team), score
            )

    def test_validation_bounds_and_missing_seasons(self):
        self.assertEqual(
            self.client.post("/api/stats", json={"metrics": ["invented"]}).status_code,
            422,
        )
        self.assertEqual(
            self.client.post("/api/stats", json={"limit": 50000}).status_code, 422
        )
        self.assertEqual(
            self.client.post(
                "/api/stats",
                json={"scope": {"season": "2026-27", "seasonType": "Playoffs"}},
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post("/api/explore/arbitrary-url", json={}).status_code, 404
        )
        self.assertEqual(
            self.client.post("/api/stats", content=b"x" * 65537).status_code, 413
        )

    def test_history_pooling_sums_components_before_ratios(self):
        query = {
            "scope": {"season": "2024-25", "mode": "totals"},
            "seasons": ["2023-24", "2024-25"],
            "metrics": ["pts", "fgm", "fga", "fg", "gp"],
            "search": "Joki",
            "pooled": True,
        }
        pooled = self.client.post("/api/history", json=query).json()["rows"][0]
        self.assertAlmostEqual(
            pooled["values"]["fg"],
            100 * pooled["values"]["fgm"] / pooled["values"]["fga"],
        )
        individual = self.client.post(
            "/api/history", json={**query, "pooled": False}
        ).json()["rows"]
        self.assertEqual(len(individual), 2)
        self.assertEqual(
            pooled["values"]["pts"], sum(row["values"]["pts"] for row in individual)
        )
        self.assertEqual(
            pooled["values"]["gp"], sum(row["values"]["gp"] for row in individual)
        )
        self.assertEqual(
            self.client.post(
                "/api/history", json={**query, "metrics": ["netRtg"]}
            ).status_code,
            422,
        )

    def test_player_profile_keeps_playoff_and_home_split(self):
        query = {"season": "2024-25", "seasonType": "Playoffs", "split": "home"}
        result = self.client.post("/api/players/203999", json=query).json()
        self.assertTrue(result["logs"])
        self.assertTrue(
            all(
                log["home"] and log["gameId"].startswith("004")
                for log in result["logs"]
            )
        )
        self.assertEqual(result["summary"]["games"], len(result["logs"]))
        self.assertIn("reb", result["summary"]["values"])
        self.assertIn("ast", result["summary"]["values"])

    def test_zone_view_enforces_appearance_eligibility_and_sample_match(self):
        base = self.client.post(
            "/api/stats",
            json={
                "scope": {"season": "2024-25", "mode": "totals"},
                "metrics": ["fga"],
                "search": "jokic",
            },
        ).json()["rows"][0]
        source_row = {
            "PLAYER_ID": 203999,
            "PLAYER_NAME": "Nikola Jokic",
            "TEAM_ABBREVIATION": "DEN",
            "_FGA": base["values"]["fga"],
        }
        self.app.state.providers.get = lambda *args, **kwargs: {"rows": [source_row]}
        self.assertEqual(
            len(
                self.client.post(
                    "/api/explore/zones", json={"season": "2024-25"}
                ).json()["rows"]
            ),
            1,
        )
        self.assertEqual(
            self.client.post(
                "/api/explore/zones", json={"season": "2024-25", "minGames": 100}
            ).json()["rows"],
            [],
        )
        source_row["_FGA"] += 1
        self.assertEqual(
            self.client.post("/api/explore/zones", json={"season": "2024-25"}).json()[
                "rows"
            ],
            [],
        )

    def test_import_is_idempotent_and_rejects_corruption_before_replace(self):
        self.assertEqual(import_snapshots(self.sessions), [])
        manifest = json.loads(
            (ROOT / "public/data/manifest.json").read_text(encoding="utf-8")
        )
        entry = manifest["seasons"][0]
        snapshot = json.loads(
            (ROOT / "public/data" / Path(entry["path"]).name).read_text(
                encoding="utf-8"
            )
        )
        snapshot["gameLogs"][0]["pts"] += 1
        temporary = Path(self.directory.name) / "corrupt"
        temporary.mkdir(exist_ok=True)
        (temporary / "manifest.json").write_text(
            json.dumps({"seasons": [entry]}), encoding="utf-8"
        )
        (temporary / Path(entry["path"]).name).write_text(
            json.dumps(snapshot), encoding="utf-8"
        )
        with self.assertRaises(ValueError):
            import_snapshots(self.sessions, temporary)
        with self.sessions() as session:
            count = session.scalar(
                select(func.count())
                .select_from(Appearance)
                .where(Appearance.season == entry["id"])
            )
        self.assertEqual(count, entry["appearanceCount"])


if __name__ == "__main__":
    unittest.main()
