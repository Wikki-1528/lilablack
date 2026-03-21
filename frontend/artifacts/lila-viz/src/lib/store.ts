import { create } from 'zustand';
import type { IndexData, MatchData } from './types';

interface Layers {
  paths: boolean;
  kills: boolean;
  deaths: boolean;
  loot: boolean;
  storm: boolean;
  bots: boolean;
}

interface VisualizerState {
  indexData: IndexData | null;
  matchData: MatchData | null;
  selectedMap: string;
  selectedDate: string;
  selectedMatchId: string | null;
  highlightedPlayerId: string | null;
  playerFilter: 'all' | 'humans' | 'bots';

  layers: Layers;
  heatmapMode: 'none' | 'kills' | 'deaths' | 'loot' | 'traffic';
  heatmapOpacity: number;

  currentTime: number;
  minTime: number;
  maxTime: number;
  isPlaying: boolean;
  playbackSpeed: number;

  setIndexData: (data: IndexData) => void;
  setMatchData: (data: MatchData | null) => void;
  setSelectedMap: (map: string) => void;
  setSelectedDate: (date: string) => void;
  setSelectedMatchId: (id: string | null) => void;
  setHighlightedPlayer: (id: string | null) => void;
  setPlayerFilter: (f: 'all' | 'humans' | 'bots') => void;
  toggleLayer: (layer: keyof Layers) => void;
  setHeatmapMode: (mode: 'none' | 'kills' | 'deaths' | 'loot' | 'traffic') => void;
  setHeatmapOpacity: (v: number) => void;
  setTimeBounds: (min: number, max: number) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
}

export const useVisualizerStore = create<VisualizerState>((set) => ({
  indexData: null,
  matchData: null,
  selectedMap: 'AmbroseValley',
  selectedDate: 'February_10',
  selectedMatchId: null,
  highlightedPlayerId: null,
  playerFilter: 'all',

  layers: { paths: true, kills: true, deaths: true, loot: true, storm: true, bots: true },
  heatmapMode: 'none',
  heatmapOpacity: 0.6,

  currentTime: 0,
  minTime: 0,
  maxTime: 0,
  isPlaying: false,
  playbackSpeed: 1,

  setIndexData: (data) => set({ indexData: data }),
  setMatchData: (data) => set({ matchData: data }),
  setSelectedMap: (map) => set({ selectedMap: map, selectedMatchId: null, matchData: null }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedMatchId: null, matchData: null }),
  setSelectedMatchId: (id) => set({ selectedMatchId: id, matchData: null }),
  setHighlightedPlayer: (id) => set({ highlightedPlayerId: id }),
  setPlayerFilter: (f) => set({ playerFilter: f }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  setHeatmapMode: (mode) => set({ heatmapMode: mode }),
  setHeatmapOpacity: (v) => set({ heatmapOpacity: v }),
  setTimeBounds: (min, max) => set({ minTime: min, maxTime: max, currentTime: min, isPlaying: false }),
  setCurrentTime: (time) =>
    set((s) => ({ currentTime: typeof time === 'function' ? time(s.currentTime) : time })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
}));
