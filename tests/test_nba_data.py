import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from nba_data import build_snapshot, validate_snapshot


def appearance(player=1, team='DEN', opponent='LAL', game='0022400001', date='2024-10-22', **stats):
    return {'PLAYER_ID': player, 'PLAYER_NAME': f'Player {player}', 'TEAM_ABBREVIATION': team,
            'GAME_ID': game, 'GAME_DATE': date, 'MATCHUP': f'{team} vs. {opponent}' if team == 'DEN' else f'{team} @ {opponent}',
            'WL': 'W', 'MIN': 30.5, 'MIN_SEC': '30:30', 'FGM': 4, 'FGA': 10, 'FG3M': 2, 'FG3A': 5,
            'FTM': 2, 'FTA': 2, 'PTS': 12, 'REB': 5, 'AST': 3, 'STL': 1, 'BLK': 0, 'TOV': 1, **stats}


def team_row(team, pts=12):
    return {'TEAM_ABBREVIATION': team, 'GAME_ID': '0022400001', 'GAME_DATE': '2024-10-22',
            'MATCHUP': f'{team} vs. LAL' if team == 'DEN' else f'{team} @ DEN', 'WL': 'W', 'PTS': pts}


class IngestionTests(unittest.TestCase):
    def snapshot(self, rows=None):
        return build_snapshot('2024-25', rows or [appearance(), appearance(2, 'LAL', 'DEN')],
                              [team_row('DEN'), team_row('LAL')], [],
                              {'id': 'nba_api', 'label': 'NBA Stats via nba_api', 'urls': ['https://stats.nba.com'], 'fetchedAt': '2026-10-25T00:00:00Z'})

    def test_ids_dates_precise_minutes_and_unavailable_metadata(self):
        snapshot = self.snapshot()
        self.assertEqual(snapshot['metadata']['playerCount'], 2)
        self.assertEqual(snapshot['metadata']['gameCount'], 1)
        self.assertEqual(snapshot['games'][0]['id'], '0022400001')
        self.assertEqual(snapshot['gameLogs'][0]['min'], 30.5)
        self.assertIsNone(snapshot['players'][0]['position'])
        self.assertIsNone(snapshot['players'][0]['number'])
        validate_snapshot(json.loads(json.dumps(snapshot)))

    def test_duplicates_do_not_inflate_totals(self):
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.snapshot([appearance(), appearance(), appearance(2, 'LAL', 'DEN')])

    def test_points_and_team_scores_reconcile(self):
        with self.assertRaisesRegex(ValueError, 'points'):
            self.snapshot([appearance(PTS=99), appearance(2, 'LAL', 'DEN')])
        with self.assertRaisesRegex(ValueError, 'score'):
            self.snapshot([appearance(PTS=13, FTM=3, FTA=3), appearance(2, 'LAL', 'DEN')])

    def test_invalid_shooting_counts_fail_closed(self):
        with self.assertRaisesRegex(ValueError, 'attempt'):
            self.snapshot([appearance(FGM=12), appearance(2, 'LAL', 'DEN')])

    def test_missing_opponent_box_score_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'two team'):
            build_snapshot('2024-25', [appearance()], [team_row('DEN')], [], {})

    def test_missing_game_is_not_silently_dropped(self):
        with self.assertRaisesRegex(ValueError, 'game'):
            self.snapshot([appearance(game='0022499999'), appearance(2, 'LAL', 'DEN')])

    def test_neutral_site_uses_designated_home_from_schedule(self):
        rows = [team_row('DEN'), team_row('LAL')]
        rows[0]['MATCHUP'] = 'DEN @ LAL'
        snapshot = build_snapshot('2024-25', [appearance(), appearance(2, 'LAL', 'DEN')], rows, [], {},
                                  [{'gameId': '0022400001', 'homeTeam_teamTricode': 'DEN', 'awayTeam_teamTricode': 'LAL'}])
        self.assertEqual(snapshot['games'][0]['home'], 'DEN')


if __name__ == '__main__':
    unittest.main()
