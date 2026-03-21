export interface MatchIndex {
  id: string;
  map: string;
  date: string;
  humans: number;
  bots: number;
  totalEvents: number;
  kills: number;
  deaths: number;
  loots: number;
  stormDeaths: number;
}

export interface IndexData {
  stats: {
    totalMatches: number;
    totalPlayers: number;
    totalEvents: number;
    maps: string[];
    dates: string[];
  };
  matches: MatchIndex[];
}

export interface PlayerEvent {
  x: number;
  z: number;
  y: number;
  ts: number;
  event: string;
}

export interface Player {
  userId: string;
  isBot: boolean;
  events: PlayerEvent[];
}

export interface MatchData {
  matchId: string;
  mapId: string;
  date: string;
  players: Player[];
}

export interface MapConfig {
  id: string;
  name: string;
  scale: number;
  originX: number;
  originZ: number;
  imageUrl: string;
}

export const MAP_CONFIGS: Record<string, MapConfig> = {
  AmbroseValley: {
    id: 'AmbroseValley',
    name: 'Ambrose Valley',
    scale: 900,
    originX: -370,
    originZ: -473,
    imageUrl: '/minimaps/AmbroseValley_Minimap.png',
  },
  GrandRift: {
    id: 'GrandRift',
    name: 'Grand Rift',
    scale: 581,
    originX: -290,
    originZ: -290,
    imageUrl: '/minimaps/GrandRift_Minimap.png',
  },
  Lockdown: {
    id: 'Lockdown',
    name: 'Lockdown',
    scale: 1000,
    originX: -500,
    originZ: -500,
    imageUrl: '/minimaps/Lockdown_Minimap.jpg',
  },
};

export function worldToPixel(x: number, z: number, mapId: string): { px: number; py: number } {
  const cfg = MAP_CONFIGS[mapId];
  if (!cfg) return { px: 0, py: 0 };
  const u = (x - cfg.originX) / cfg.scale;
  const v = (z - cfg.originZ) / cfg.scale;
  return { px: u * 1024, py: (1 - v) * 1024 };
}

export const HUMAN_COLORS = [
  '#00e5ff', '#39ff14', '#ff6b6b', '#ffd700',
  '#a855f7', '#fb923c', '#60a5fa', '#f472b6',
  '#34d399', '#f59e0b', '#818cf8', '#e879f9',
];

export const EVENT_COLORS: Record<string, string> = {
  Kill: '#ef4444',
  Killed: '#f97316',
  BotKill: '#ec4899',
  BotKilled: '#f97316',
  KilledByStorm: '#a855f7',
  Loot: '#22c55e',
};

export function formatDate(date: string): string {
  return date.replace('February_', 'Feb ');
}

export function formatRelativeTime(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getPlayerStatus(player: Player): 'Extracted' | 'Killed' | 'Storm' | 'Active' | 'Unknown' {
  const last = player.events[player.events.length - 1];
  if (!last) return 'Unknown';
  if (last.event === 'KilledByStorm') return 'Storm';
  if (last.event === 'Killed' || last.event === 'BotKilled') return 'Killed';
  if (last.event === 'Position' || last.event === 'Loot') return 'Extracted';
  if (last.event === 'BotPosition') return 'Active';
  return 'Unknown';
}
