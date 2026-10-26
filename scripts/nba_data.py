"""Validated season snapshots. Network access is confined to explicit sync commands.

NBA endpoints: https://github.com/swar/nba_api/tree/master/docs/nba_api/stats/endpoints
Archive schema: https://github.com/sportsdataverse/hoopR-nba-stats-data
"""
import argparse
import csv
import hashlib
import gzip
import io
import json
import math
import os
import re
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.data-cache' / 'raw'
OUTPUT = ROOT / 'public' / 'data'
TEAM_IDS = {1610612737: 'ATL', 1610612738: 'BOS', 1610612751: 'BKN', 1610612766: 'CHA', 1610612741: 'CHI',
            1610612739: 'CLE', 1610612742: 'DAL', 1610612743: 'DEN', 1610612765: 'DET', 1610612744: 'GSW',
            1610612745: 'HOU', 1610612754: 'IND', 1610612746: 'LAC', 1610612747: 'LAL', 1610612763: 'MEM',
            1610612748: 'MIA', 1610612749: 'MIL', 1610612750: 'MIN', 1610612740: 'NOP', 1610612752: 'NYK',
            1610612760: 'OKC', 1610612753: 'ORL', 1610612755: 'PHI', 1610612756: 'PHX', 1610612757: 'POR',
            1610612758: 'SAC', 1610612759: 'SAS', 1610612761: 'TOR', 1610612762: 'UTA', 1610612764: 'WAS'}
ALIASES = {'PHO': 'PHX', 'BRK': 'BKN', 'CHO': 'CHA'}
STATS = {'pts': 'PTS', 'reb': 'REB', 'ast': 'AST', 'stl': 'STL', 'blk': 'BLK', 'tov': 'TOV',
         'fgm': 'FGM', 'fga': 'FGA', 'fg3m': 'FG3M', 'fg3a': 'FG3A', 'ftm': 'FTM', 'fta': 'FTA'}
OPTIONAL_STATS = {'oreb':'OREB','dreb':'DREB','pf':'PF','plusMinus':'PLUS_MINUS'}


def stamp():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def abbr(value):
    result = ALIASES.get(str(value), str(value))
    if result not in TEAM_IDS.values():
        raise ValueError(f'Unknown team abbreviation: {value}')
    return result


def minutes(row):
    value = row.get('MIN_SEC')
    if value and re.fullmatch(r'\d+:\d{2}', str(value)):
        whole, seconds = map(int, value.split(':'))
        return round(whole + seconds / 60, 6)
    return float(row.get('MIN') or 0)


def build_snapshot(season, player_rows, team_rows, roster_rows, source, schedule_rows=None, season_type='Regular Season'):
    """Normalize one provider only; preserve a player's game-by-game team history."""
    pairs = defaultdict(list)
    for row in team_rows:
        if row.get('WL') not in ('W', 'L'):
            continue
        pairs[str(row['GAME_ID']).zfill(10)].append(row)
    games = []
    schedule = {str(row['gameId']).zfill(10): row for row in (schedule_rows or [])}
    for game_id, pair in pairs.items():
        if len(pair) != 2:
            raise ValueError(f'Game {game_id} needs exactly two team records')
        home = [row for row in pair if 'vs.' in row['MATCHUP']]
        away = [row for row in pair if ' @ ' in row['MATCHUP']]
        if len(home) != 1 or len(away) != 1:
            # Neutral-site games can label BOTH participants '@'. Use designated
            # home/away from the schedule, never row ordering or the winner.
            scheduled = schedule.get(game_id, {})
            home = [row for row in pair if row['TEAM_ABBREVIATION'] == scheduled.get('homeTeam_teamTricode')]
            away = [row for row in pair if row['TEAM_ABBREVIATION'] == scheduled.get('awayTeam_teamTricode')]
            if len(home) != 1 or len(away) != 1:
                raise ValueError(f'Invalid game home/away pair: {game_id}')
        games.append({'id': game_id, 'season': season, 'date': str(home[0]['GAME_DATE'])[:10],
                      'home': abbr(home[0]['TEAM_ABBREVIATION']), 'away': abbr(away[0]['TEAM_ABBREVIATION']),
                      'homeScore': int(home[0]['PTS']), 'awayScore': int(away[0]['PTS'])})
    game_by_id = {game['id']: game for game in games}
    rosters = {int(row['PLAYER_ID']): row for row in roster_rows}
    players = {}
    logs = []
    for row in sorted(player_rows, key=lambda item: (str(item['GAME_DATE']), str(item['GAME_ID']))):
        if row.get('WL') not in ('W', 'L'):
            continue
        player_id = int(row['PLAYER_ID'])
        game_id = str(row['GAME_ID']).zfill(10)
        if game_id not in game_by_id:
            raise ValueError(f'Player appearance references absent game {game_id}')
        game = game_by_id[game_id]
        team = abbr(row['TEAM_ABBREVIATION'])
        if team not in (game['home'], game['away']):
            raise ValueError(f'Player team not in game {game_id}')
        roster = rosters.get(player_id, {})
        players[player_id] = {'id': player_id, 'name': str(row['PLAYER_NAME']), 'team': team,
                              'position': roster.get('POSITION') or None,
                              'number': str(roster['NUM']) if roster.get('NUM') not in (None, '') else None,
                              'age': float(roster['AGE']) if roster.get('AGE') not in (None, '') else None,
                              'height': roster.get('HEIGHT') or None}
        logs.append({'gameId': game_id, 'playerId': player_id, 'season': season, 'date': str(row['GAME_DATE'])[:10],
                     'team': team, 'opponent': game['away'] if team == game['home'] else game['home'],
                     'home': team == game['home'], 'min': minutes(row),
                     **{key: float(row[field]) for key, field in STATS.items()},
                     **{key: float(row[field]) for key, field in OPTIONAL_STATS.items() if row.get(field) is not None}})
    if not games or not logs:
        raise ValueError(f'No played NBA regular-season data for {season}')
    games.sort(key=lambda game: (game['date'], game['id']))
    metadata = {'id': season, 'from': games[0]['date'], 'to': games[-1]['date'], 'playerCount': len(players),
                'gameCount': len(games), 'appearanceCount': len(logs), 'source': source,
                'complete': len(games) == 1230 if season_type == 'Regular Season' else False, 'seasonType': season_type,
                'unknownPositions': sum(not p['position'] for p in players.values()),
                'minutesPrecision': 'seconds' if any(row.get('MIN_SEC') for row in player_rows) else 'source minutes'}
    snapshot = {'schemaVersion': 1, 'metadata': metadata, 'players': sorted(players.values(), key=lambda p: p['name']),
                'games': games, 'gameLogs': logs}
    validate_snapshot(snapshot)
    return snapshot


def validate_snapshot(snapshot):
    ids = set()
    game_by_id = {game['id']: game for game in snapshot['games']}
    player_ids = {player['id'] for player in snapshot['players']}
    sums = defaultdict(float)
    teams_seen = defaultdict(set)
    for log in snapshot['gameLogs']:
        key = (log['gameId'], log['playerId'])
        if key in ids:
            raise ValueError(f'duplicate player-game record: {key}')
        ids.add(key)
        game = game_by_id.get(log['gameId'])
        if not game or log['playerId'] not in player_ids or log['date'] != game['date']:
            raise ValueError('Invalid game/player/date reference')
        prefix = '004' if snapshot['metadata'].get('seasonType') == 'Playoffs' else '002'
        if not re.fullmatch(prefix + r'\d{7}', game['id']):
            raise ValueError('NBA game does not match the snapshot season type')
        for field in ('min', *STATS):
            if not isinstance(log[field], (int, float)) or not math.isfinite(log[field]) or log[field] < 0:
                raise ValueError(f'Invalid numeric field: {field}')
        for made, attempted in [('fgm', 'fga'), ('fg3m', 'fg3a'), ('ftm', 'fta')]:
            if log[made] > log[attempted]:
                raise ValueError('Made shots exceed attempts')
        for field in OPTIONAL_STATS:
            if field in log and (not isinstance(log[field], (int, float)) or not math.isfinite(log[field]) or (field != 'plusMinus' and log[field] < 0)):
                raise ValueError(f'Invalid optional field: {field}')
        if 'oreb' in log and 'dreb' in log and log['oreb'] + log['dreb'] != log['reb']:
            raise ValueError('Rebound components do not reconcile')
        if log['fg3m'] > log['fgm'] or log['fg3a'] > log['fga']:
            raise ValueError('Invalid three-point attempts')
        if log['pts'] != 2 * log['fgm'] + log['fg3m'] + log['ftm']:
            raise ValueError('Player points do not reconcile with made shots')
        sums[(game['id'], log['team'])] += log['pts']
        teams_seen[game['id']].add(log['team'])
    for game in snapshot['games']:
        if teams_seen[game['id']] != {game['home'], game['away']}:
            raise ValueError(f'Missing player game coverage: {game["id"]}')
        for side in ('home', 'away'):
            if sums[(game['id'], game[side])] != game[f'{side}Score']:
                raise ValueError(f'Player points do not reconcile with team score: {game["id"]} {game[side]}')


def cached_json(name, fetch, refresh=False):
    path = CACHE / name
    if path.exists() and not refresh:
        return json.loads(path.read_text(encoding='utf-8'))
    data = fetch()
    path.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    time.sleep(.6)
    return data


def fetch_nba(season, refresh=False, season_type='Regular Season'):
    from nba_api.stats.endpoints import leaguegamelog, playergamelogs, commonteamroster, scheduleleaguev2
    cache_id = season + ('-playoffs' if season_type == 'Playoffs' else '')
    team_rows = cached_json(f'nba-{cache_id}-T.json', lambda: leaguegamelog.LeagueGameLog(
        season=season, season_type_all_star=season_type, player_or_team_abbreviation='T', timeout=15).get_normalized_dict()['LeagueGameLog'], refresh)
    # PlayerGameLogs includes fractional MIN and MIN_SEC; one request covers the league.
    player_rows = cached_json(f'nba-{cache_id}-playergamelogs.json', lambda: playergamelogs.PlayerGameLogs(
        season_nullable=season, season_type_nullable=season_type, timeout=15).get_normalized_dict()['PlayerGameLogs'], refresh)
    schedule_rows = cached_json(f'nba-{season}-schedule.json', lambda: scheduleleaguev2.ScheduleLeagueV2(
        season=season, timeout=15).get_normalized_dict()['SeasonGames'], refresh)
    roster_rows = []
    for team_id in TEAM_IDS:
        try:
            roster_rows.extend(cached_json(f'roster-{season}-{team_id}.json', lambda team_id=team_id:
                commonteamroster.CommonTeamRoster(team_id=team_id, season=season, timeout=8).get_normalized_dict()['CommonTeamRoster'], refresh))
        except Exception as exc:
            print(f'  Roster metadata unavailable for {TEAM_IDS[team_id]}: {type(exc).__name__}', flush=True)
    urls = ['https://stats.nba.com/stats/playergamelogs', 'https://stats.nba.com/stats/leaguegamelog', 'https://stats.nba.com/stats/commonteamroster', 'https://stats.nba.com/stats/scheduleleaguev2']
    fetched = datetime.fromtimestamp((CACHE / f'nba-{cache_id}-playergamelogs.json').stat().st_mtime, timezone.utc).isoformat(timespec='seconds')
    return build_snapshot(season, player_rows, team_rows, roster_rows,
                          {'id': 'nba_api', 'label': 'NBA Stats via nba_api', 'urls': urls, 'fetchedAt': fetched}, schedule_rows, season_type)


def download_csv(tag, filename, refresh):
    url = f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/{tag}/{filename}'
    path = CACHE / filename
    if not path.exists() or refresh:
        request = urllib.request.Request(url, headers={'User-Agent': 'ballknowledge-local-data-sync/0.1'})
        with urllib.request.urlopen(request, timeout=30) as response:
            content = response.read(50_000_001)
        if len(content) > 50_000_000:
            raise ValueError('Archive exceeded download size limit')
        path.write_bytes(content)
    text = gzip.decompress(path.read_bytes()).decode('utf-8-sig') if filename.endswith('.gz') else path.read_text(encoding='utf-8-sig')
    return list(csv.DictReader(io.StringIO(text))), url


def fetch_archive(season, refresh=False):
    """Archives are explicit fallbacks with the same NBA IDs, never ESPN-ID substitution."""
    year = int(season[:4]) + 1
    box, box_url = download_csv('nba_stats_player_boxscores', f'player_boxscores_{year}.csv', refresh)
    team_box, team_url = download_csv('nba_stats_team_boxscores', f'team_boxscores_{year}.csv', refresh)
    schedule, schedule_url = download_csv('nba_stats_schedules', f'nba_schedule_{year}.csv.gz', refresh)
    roster, roster_url = download_csv('nba_stats_rosters', f'rosters_{year}.csv', refresh)
    dates = {str(row.get('game_id', row.get('gameId', ''))).zfill(10): str(row.get('game_date', row.get('gameDate', row.get('game_date_time_est', ''))))[:10] for row in schedule}
    # Schema fails closed if archive names change; source URLs are in metadata for audit.
    def common(row):
        game_id = str(row['game_id']).zfill(10)
        if game_id not in dates or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', dates[game_id]):
            raise ValueError('Archive schedule date schema unavailable')
        team = abbr(row['team_tricode'])
        side = 'vs.' if row['side'] == 'home' else '@'
        return {'GAME_ID': game_id, 'GAME_DATE': dates[game_id], 'TEAM_ABBREVIATION': team,
                'MATCHUP': f'{team} {side} opponent', 'WL': 'W', 'PTS': int(float(row['points']))}
    team_rows = [common(row) for row in team_box if row['season_type_id'] == '2' and str(row['game_id']).zfill(10).startswith('002')]
    player_rows = []
    mapping = {'FGM': 'field_goals_made', 'FGA': 'field_goals_attempted', 'FG3M': 'three_pointers_made', 'FG3A': 'three_pointers_attempted', 'FTM': 'free_throws_made', 'FTA': 'free_throws_attempted', 'REB': 'rebounds_total', 'AST': 'assists', 'STL': 'steals', 'BLK': 'blocks', 'TOV': 'turnovers'}
    for row in box:
        if row['season_type_id'] != '2' or not row['minutes'] or not str(row['game_id']).zfill(10).startswith('002'):
            continue
        player_rows.append({**common(row), 'PLAYER_ID': int(row['person_id']), 'PLAYER_NAME': f'{row["first_name"]} {row["family_name"]}', 'MIN_SEC': row['minutes'], **{key: float(row[value]) for key, value in mapping.items()}})
    roster_rows = [{'PLAYER_ID': row['player_id'], 'POSITION': row['position'], 'NUM': row['num'], 'HEIGHT': row['height'], 'AGE': row['age']} for row in roster]
    oldest_fetch = min((CACHE / name).stat().st_mtime for name in [f'player_boxscores_{year}.csv', f'team_boxscores_{year}.csv', f'nba_schedule_{year}.csv.gz', f'rosters_{year}.csv'])
    fetched_at = datetime.fromtimestamp(oldest_fetch, timezone.utc).isoformat(timespec='seconds')
    return build_snapshot(season, player_rows, team_rows, roster_rows, {'id': 'sportsdataverse', 'label': 'NBA Stats archive · SportsDataverse', 'urls': [box_url, team_url, schedule_url, roster_url], 'fetchedAt': fetched_at})


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    if path.exists():
        path.chmod(0o666)
    os.replace(temporary, path)


def main():
    parser = argparse.ArgumentParser(description='Fetch and validate full NBA regular-season snapshots.')
    parser.add_argument('--seasons', nargs='+', default=['2026-27', '2025-26', '2024-25', '2023-24'])
    parser.add_argument('--provider', choices=['auto', 'nba-api', 'archive'], default='auto')
    parser.add_argument('--refresh', action='store_true', help='Fetch fresh source responses instead of reusing the raw cache')
    parser.add_argument('--season-type', choices=['Regular Season','Playoffs'], default='Regular Season')
    args = parser.parse_args()
    if any(not re.fullmatch(r'20\d{2}-\d{2}', season) or int(season[-2:]) != (int(season[:4]) + 1) % 100 for season in args.seasons):
        parser.error('Use NBA season IDs such as 2024-25.')
    CACHE.mkdir(parents=True, exist_ok=True)
    output = OUTPUT / 'playoffs' if args.season_type == 'Playoffs' else OUTPUT
    output.mkdir(parents=True, exist_ok=True)
    manifest_path = output / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'schemaVersion': 1, 'seasons': []}
    records = {entry['id']: entry for entry in manifest['seasons']}
    failures = []
    for season in args.seasons:
        print(f'Syncing {season} ({args.provider})…', flush=True)
        try:
            try:
                if args.season_type == 'Playoffs' and args.provider == 'archive':
                    raise ValueError('Archive adapter supports regular-season snapshots only')
                snapshot = fetch_archive(season, args.refresh) if args.provider == 'archive' else fetch_nba(season, args.refresh, args.season_type)
            except Exception as exc:
                if args.provider != 'auto' or args.season_type == 'Playoffs':
                    raise
                print(f'  NBA source unavailable or failed validation: {exc}; trying NBA Stats archive.', flush=True)
                snapshot = fetch_archive(season, args.refresh)
            # Content-addressed files let an old manifest keep pointing at valid old snapshots.
            encoded = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            digest = hashlib.sha256(encoded).hexdigest()[:12]
            filename = f'{season}-{digest}.json'
            atomic_json(output / filename, snapshot)
            records[season] = {**snapshot['metadata'], 'path': f'/data/{"playoffs/" if args.season_type == "Playoffs" else ""}{filename}'}
            print(f'  Published {snapshot["metadata"]["playerCount"]} players, {len(snapshot["games"])} games, {len(snapshot["gameLogs"])} appearances.', flush=True)
        except Exception as exc:
            failures.append(season)
            print(f'  FAILED: {exc}. Previous snapshot retained.', flush=True)
    if records:
        seasons = sorted(records.values(), key=lambda entry: entry['id'], reverse=True)
        catalog = {}
        for entry in reversed(seasons):
            snapshot = json.loads((output / Path(entry['path']).name).read_text(encoding='utf-8'))
            catalog.update({player['id']: player for player in snapshot['players']})
        atomic_json(output / 'players.json', sorted(catalog.values(), key=lambda player: player['name']))
        atomic_json(manifest_path, {'schemaVersion': 1, 'defaultSeason': seasons[0]['id'], 'seasons': seasons})
    if failures:
        raise SystemExit(f'Sync incomplete for {", ".join(failures)}; no synthetic fallback was used.')


if __name__ == '__main__':
    main()
