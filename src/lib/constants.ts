/** Playback: 1 real ms → TIME_COMPRESSION match ms at 1× speed.
 *  A 12-min match plays in ~75 s at 1×, ~9 s at 8×. */
export const TIME_COMPRESSION = 10;

/** Speed options available in the Timeline controls */
export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;

/** Canvas resolution for map rendering (square) */
export const CANVAS_SIZE = 1024;

/** Dash pattern used for bot paths and AI highlight circles [dash, gap] */
export const BOT_DASH_PATTERN: number[] = [4, 6];

/** Weights used by matchScore() to rank replay quality */
export const MATCH_SCORE_WEIGHTS = {
  playerCount: 20,
  botKills:     5,
  kills:        4,
  loots:        0.5,
  events:       0.02,
} as const;
