import { create } from 'zustand';
import type { IndexData, MatchData, AnalyticsData, AiHighlightZone, ChatMessage } from './types';

export type AppMode = 'replay' | 'analytics' | 'ai';
export type ActivePanel = 'layers' | 'heatmap' | 'players' | 'events' | 'stats' | null;
export type AnalyticsOverlay = 'traffic' | 'kd' | 'deadzone' | 'loot' | 'hotdrop' | 'botvhuman' | 'storm';

interface Layers {
  paths: boolean;
  kills: boolean;
  deaths: boolean;
  loot: boolean;
  storm: boolean;
  bots: boolean;
}

interface VisualizerState {
  // App mode
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;

  // Active panel
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;

  // Data
  indexData: IndexData | null;
  matchData: MatchData | null;
  analyticsData: Record<string, AnalyticsData>;

  // Selection
  selectedMap: string;
  selectedDate: string;
  selectedMatchId: string | null;

  // Player focus
  highlightedPlayerId: string | null;
  playerFilter: 'all' | 'humans' | 'bots';

  // Replay layers
  layers: Layers;
  pathStyle: 'solid' | 'dotted';

  // Analytics
  analyticsOverlay: AnalyticsOverlay;
  heatmapOpacity: number;
  selectedDates: string[];

  // AI
  aiMessages: ChatMessage[];
  aiHighlightZones: AiHighlightZone[];
  geminiApiKey: string;

  // Timeline / playback
  currentTime: number;
  minTime: number;
  maxTime: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Actions
  setIndexData: (data: IndexData) => void;
  setMatchData: (data: MatchData | null) => void;
  setAnalyticsData: (mapId: string, data: AnalyticsData) => void;
  setSelectedMap: (map: string) => void;
  setSelectedDate: (date: string) => void;
  setSelectedMatchId: (id: string | null) => void;
  setHighlightedPlayer: (id: string | null) => void;
  setPlayerFilter: (f: 'all' | 'humans' | 'bots') => void;
  toggleLayer: (layer: keyof Layers) => void;
  setPathStyle: (style: 'solid' | 'dotted') => void;
  setAnalyticsOverlay: (overlay: AnalyticsOverlay) => void;
  setHeatmapOpacity: (opacity: number) => void;
  toggleSelectedDate: (date: string) => void;
  setAllDates: (dates: string[]) => void;
  addAiMessage: (msg: ChatMessage) => void;
  clearAiMessages: () => void;
  setAiHighlightZones: (zones: AiHighlightZone[]) => void;
  setGeminiApiKey: (key: string) => void;
  setTimeBounds: (min: number, max: number) => void;
  setCurrentTime: (time: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
}

const ALL_DATES = ['February_10', 'February_11', 'February_12', 'February_13', 'February_14'];

export const useVisualizerStore = create<VisualizerState>((set) => ({
  appMode: 'replay',
  activePanel: null,
  indexData: null,
  matchData: null,
  analyticsData: {},
  selectedMap: 'AmbroseValley',
  selectedDate: 'February_10',
  selectedMatchId: null,
  highlightedPlayerId: null,
  playerFilter: 'all',
  layers: { paths: true, kills: true, deaths: true, loot: true, storm: true, bots: true },
  pathStyle: 'solid',
  analyticsOverlay: 'traffic',
  heatmapOpacity: 0.85,
  selectedDates: [...ALL_DATES],
  aiMessages: [],
  aiHighlightZones: [],
  geminiApiKey: (import.meta.env.VITE_GEMINI_API_KEY as string) || (typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_api_key') ?? '') : ''),
  currentTime: 0,
  minTime: 0,
  maxTime: 0,
  isPlaying: false,
  playbackSpeed: 1,

  setAppMode: (mode) => set((s) => ({
    appMode: mode,
    activePanel: null,
    // Keep highlight zones alive when switching into AI mode
    aiHighlightZones: mode === 'ai' ? s.aiHighlightZones : [],
  })),
  setActivePanel: (panel) => set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),
  setIndexData: (data) => set({ indexData: data }),
  setMatchData: (data) => set({ matchData: data }),
  setAnalyticsData: (mapId, data) => set((s) => ({ analyticsData: { ...s.analyticsData, [mapId]: data } })),
  setSelectedMap: (map) => set({ selectedMap: map, selectedMatchId: null, matchData: null, aiHighlightZones: [] }),
  setSelectedDate: (date) => set({ selectedDate: date, selectedMatchId: null, matchData: null }),
  setSelectedMatchId: (id) => set({ selectedMatchId: id, matchData: null }),
  setHighlightedPlayer: (id) => set({ highlightedPlayerId: id }),
  setPlayerFilter: (f) => set({ playerFilter: f }),
  toggleLayer: (layer) => set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  setPathStyle: (style) => set({ pathStyle: style }),
  setAnalyticsOverlay: (overlay) => set({ analyticsOverlay: overlay }),
  setHeatmapOpacity: (opacity) => set({ heatmapOpacity: opacity }),
  toggleSelectedDate: (date) => set((s) => ({
    selectedDates: s.selectedDates.includes(date)
      ? s.selectedDates.filter((d) => d !== date)
      : [...s.selectedDates, date],
  })),
  setAllDates: (dates) => set({ selectedDates: dates }),
  addAiMessage: (msg) => set((s) => ({ aiMessages: [...s.aiMessages, msg] })),
  clearAiMessages: () => set({ aiMessages: [], aiHighlightZones: [] }),
  setAiHighlightZones: (zones) => set({ aiHighlightZones: zones }),
  setGeminiApiKey: (key) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem('gemini_api_key', key);
    set({ geminiApiKey: key });
  },
  setTimeBounds: (min, max) => set({ minTime: min, maxTime: max, currentTime: min, isPlaying: false }),
  setCurrentTime: (time) =>
    set((s) => ({ currentTime: typeof time === 'function' ? time(s.currentTime) : time })),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
}));
