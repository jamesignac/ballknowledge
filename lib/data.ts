import manifest from "../public/data/manifest.json";
import catalog from "../public/data/players.json";
import playoffManifest from "../public/data/playoffs/manifest.json";

export interface Player {
  id: number;
  name: string;
  team: string;
  position: string | null;
  number: string | number | null;
  age: number | null;
  height: string | null;
}
export interface DataSource {
  id: string;
  label: string;
  urls: string[];
  fetchedAt: string;
}
export interface SeasonMetadata {
  id: string;
  from: string;
  to: string;
  playerCount: number;
  gameCount: number;
  appearanceCount: number;
  source: DataSource;
  complete: boolean;
  unknownPositions: number;
  minutesPrecision: string;
  path?: string;
}
export interface SeasonData {
  schemaVersion: 1;
  metadata: SeasonMetadata;
  players: Player[];
  games: Game[];
  gameLogs: GameLog[];
}
export const seasons: SeasonMetadata[] = manifest.seasons;
export const playoffSeasons: SeasonMetadata[] = playoffManifest.seasons;
export const players: Player[] = catalog;
export const latestSeason = manifest.defaultSeason;
export const emptySeason: SeasonData = {
  schemaVersion: 1,
  metadata: seasons[0],
  players: [],
  games: [],
  gameLogs: [],
};
export const teams = [
  ["ATL", "Atlanta Hawks", "#a82e3c"],
  ["BOS", "Boston Celtics", "#28764e"],
  ["BKN", "Brooklyn Nets", "#454849"],
  ["CHA", "Charlotte Hornets", "#008090"],
  ["CHI", "Chicago Bulls", "#bc3545"],
  ["CLE", "Cleveland Cavaliers", "#8a344a"],
  ["DAL", "Dallas Mavericks", "#287cb3"],
  ["DEN", "Denver Nuggets", "#324d74"],
  ["DET", "Detroit Pistons", "#b13d46"],
  ["GSW", "Golden State Warriors", "#3164b2"],
  ["HOU", "Houston Rockets", "#bb343c"],
  ["IND", "Indiana Pacers", "#997624"],
  ["LAC", "LA Clippers", "#386696"],
  ["LAL", "Los Angeles Lakers", "#7955a0"],
  ["MEM", "Memphis Grizzlies", "#5678a6"],
  ["MIA", "Miami Heat", "#a9324b"],
  ["MIL", "Milwaukee Bucks", "#327453"],
  ["MIN", "Minnesota Timberwolves", "#397384"],
  ["NOP", "New Orleans Pelicans", "#8e7236"],
  ["NYK", "New York Knicks", "#c46b2e"],
  ["OKC", "Oklahoma City Thunder", "#347ead"],
  ["ORL", "Orlando Magic", "#357aac"],
  ["PHI", "Philadelphia 76ers", "#426eaf"],
  ["PHX", "Phoenix Suns", "#a66b31"],
  ["POR", "Portland Trail Blazers", "#b34443"],
  ["SAC", "Sacramento Kings", "#79519b"],
  ["SAS", "San Antonio Spurs", "#66787f"],
  ["TOR", "Toronto Raptors", "#b83e49"],
  ["UTA", "Utah Jazz", "#70639c"],
  ["WAS", "Washington Wizards", "#426e89"],
].map(([abbr, name, color]) => ({ abbr, name, color }));

export interface Game {
  id: string;
  date: string;
  season: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}
export interface GameLog {
  gameId: string;
  playerId: number;
  season: string;
  date: string;
  team: string;
  opponent: string;
  home: boolean;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
}
