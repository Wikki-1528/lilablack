import { MAP_CONFIGS } from '@/lib/types';

// ── Suggested questions per map ───────────────────────────────────────────────

export const SUGGESTED: Record<string, string[]> = {
  AmbroseValley: [
    'Which zones have the worst K/D ratio?',
    'Where do most storm deaths cluster?',
    'Show me the hottest drop locations',
    'Where are the dead zones on this map?',
    'How do bot and human paths differ?',
  ],
  GrandRift: [
    'What is the deadliest area on Grand Rift?',
    'Where do players land most often?',
    'Which zones have the highest loot density?',
    'Show me the dead zones',
  ],
  Lockdown: [
    'Where do most deaths cluster on Lockdown?',
    'Which areas have zero player traffic?',
    'Show storm death clusters',
    'What is the hottest drop location?',
  ],
};

// ── Zone graph types ──────────────────────────────────────────────────────────

const ZONE_NAMES: Record<string, string> = {
  '0,0': 'NW Corner', '0,1': 'North',   '0,2': 'NE Corner',
  '1,0': 'West',      '1,1': 'Central', '1,2': 'East',
  '2,0': 'SW Corner', '2,1': 'South',   '2,2': 'SE Corner',
};

export interface ZoneNode {
  id: string; name: string; mr: number; mc: number;
  kills: number; deaths: number; ht: number; bt: number;
  loot: number; sd: number; hd: number; kd: number | null;
  worldX: number; worldZ: number;
}

export interface ZoneEdge {
  from: string; to: string;
  type: 'kill_corridor' | 'traffic_flow' | 'bot_overlap';
  weight: number; note: string;
}

// ── Zone graph builder ────────────────────────────────────────────────────────

export function buildZoneGraph(data: any, mapId: string): { nodes: ZoneNode[]; edges: ZoneEdge[] } {
  const cells = data.cells as any[];
  const gs    = data.gridSize as number;
  const macro = 3;
  const span  = gs / macro;
  const cfg   = MAP_CONFIGS[mapId];

  const zoneMap = new Map<string, ZoneNode>();
  for (let mr = 0; mr < macro; mr++) {
    for (let mc = 0; mc < macro; mc++) {
      const id = `${mr},${mc}`;
      // Normalised centre of this macro zone
      const normalizedU = (mc * span + span / 2) / gs;
      const normalizedV = 1 - (mr * span + span / 2) / gs;
      zoneMap.set(id, {
        id, name: ZONE_NAMES[id] ?? id, mr, mc,
        kills: 0, deaths: 0, ht: 0, bt: 0, loot: 0, sd: 0, hd: 0, kd: null,
        worldX: Math.round(cfg.originX + normalizedU * cfg.scale),
        worldZ: Math.round(cfg.originZ + normalizedV * cfg.scale),
      });
    }
  }

  for (const c of cells) {
    const id = `${Math.floor(c.row / span)},${Math.floor(c.col / span)}`;
    const z  = zoneMap.get(id);
    if (!z) continue;
    z.kills += c.k; z.deaths += c.d; z.ht += c.ht; z.bt += c.bt;
    z.loot  += c.lo; z.sd += c.sd; z.hd += c.hd;
  }

  for (const z of zoneMap.values()) {
    if (z.deaths > 0) z.kd = Math.round((z.kills / z.deaths) * 100) / 100;
  }

  const nodes = Array.from(zoneMap.values());
  const maxK  = Math.max(1, ...nodes.map(n => n.kills));
  const maxHT = Math.max(1, ...nodes.map(n => n.ht));
  const edges: ZoneEdge[] = [];

  for (let r = 0; r < macro; r++) {
    for (let c = 0; c < macro; c++) {
      const a = zoneMap.get(`${r},${c}`)!;
      const neighbors = [
        c + 1 < macro ? zoneMap.get(`${r},${c + 1}`) : null,
        r + 1 < macro ? zoneMap.get(`${r + 1},${c}`) : null,
      ].filter(Boolean) as ZoneNode[];

      for (const b of neighbors) {
        if (a.kills > 0 && b.kills > 0) {
          const w = +((a.kills + b.kills) / (2 * maxK)).toFixed(2);
          if (w > 0.04) edges.push({ from: a.id, to: b.id, type: 'kill_corridor', weight: w, note: `${a.kills + b.kills} combined kills` });
        }
        if (a.ht > 0 && b.ht > 0) {
          const w = +((a.ht + b.ht) / (2 * maxHT)).toFixed(2);
          if (w > 0.08) edges.push({ from: a.id, to: b.id, type: 'traffic_flow', weight: w, note: `${a.ht + b.ht} position samples` });
        }
        if (a.ht > 0 && a.bt > 0 && b.ht > 0 && b.bt > 0) {
          edges.push({ from: a.id, to: b.id, type: 'bot_overlap', weight: 1.0, note: 'contested by bots and humans' });
        }
      }
    }
  }
  return { nodes, edges };
}

// ── Context string builder (fed into the LLM prompt) ─────────────────────────

export function buildGraphContext(query: string, data: any, mapId: string): string {
  const q = query.toLowerCase();
  const s = data.summary;
  const { nodes, edges } = buildZoneGraph(data, mapId);

  let ranked = [...nodes];
  if      (q.match(/kill|kd|danger|choke|combat/)) ranked = ranked.filter(z => z.kills > 0).sort((a, b) => b.kills - a.kills);
  else if (q.match(/drop|land|spawn|start/))        ranked = ranked.filter(z => z.hd > 0).sort((a, b) => b.hd - a.hd);
  else if (q.match(/storm|shrink|circle/))          ranked = ranked.filter(z => z.sd > 0).sort((a, b) => b.sd - a.sd);
  else if (q.match(/dead|empty|unused|avoid/))      ranked = ranked.filter(z => z.ht === 0 && z.bt === 0);
  else if (q.match(/loot|item|pick/))               ranked = ranked.filter(z => z.loot > 0).sort((a, b) => b.loot - a.loot);
  else if (q.match(/bot|overlap|ai|npc/))           ranked = ranked.filter(z => z.bt > 0).sort((a, b) => (b.bt + b.ht) - (a.bt + a.ht));
  else                                               ranked = ranked.sort((a, b) => (b.kills + b.ht * 0.01) - (a.kills + a.ht * 0.01));

  const topKill    = [...nodes].sort((a, b) => b.kills - a.kills)[0];
  const topHotdrop = [...nodes].sort((a, b) => b.hd - a.hd)[0];
  const topStorm   = [...nodes].sort((a, b) => b.sd - a.sd)[0];
  const deadZones  = nodes.filter(z => z.ht === 0 && z.bt === 0).map(z => z.name);

  const topIds   = new Set(ranked.slice(0, 5).map(z => z.id));
  const relEdges = edges.filter(e => topIds.has(e.from) || topIds.has(e.to)).slice(0, 8);

  const nodeLines = ranked.slice(0, 6).map(z =>
    `  ${z.name}(${z.worldX},${z.worldZ}): kills=${z.kills} deaths=${z.deaths} ht=${z.ht} bt=${z.bt} loot=${z.loot} storm=${z.sd} hotdrops=${z.hd} kd=${z.kd ?? '-'}`
  ).join('\n');

  const edgeLines = relEdges.length
    ? relEdges.map(e => {
        const a = nodes.find(n => n.id === e.from)!;
        const b = nodes.find(n => n.id === e.to)!;
        return `  ${a.name} ↔ ${b.name} [${e.type} strength=${e.weight}] — ${e.note}`;
      }).join('\n')
    : '  (no significant zone relationships for this query)';

  return `ZONE GRAPH — ${mapId} · ${data.matchCount} matches
GLOBAL: dead=${s.deadZonePercent}% botOverlap=${Math.round(s.botHumanOverlap * 100)}% avgKD=${s.avgKdRatio} totalKills=${s.totalKills} totalLoot=${s.totalLoot}
LANDMARKS: topKillZone=${topKill?.name} hotDrop=${topHotdrop?.name} stormZone=${topStorm?.name} deadZones=[${deadZones.join(', ') || 'none'}]

NODES (query-relevant zones, world coords in parentheses):
${nodeLines}

ZONE RELATIONSHIPS (edges):
${edgeLines}`;
}
