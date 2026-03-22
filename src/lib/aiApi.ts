import type { AiHighlightZone, AiChart } from '@/lib/types';

// ── Rate-limit helpers ────────────────────────────────────────────────────────

export function parseRetryAfter(msg: string): number {
  const m = msg.match(/retry in (\d+(?:\.\d+)?)s/i) ?? msg.match(/\b(\d+(?:\.\d+)?)s\b/);
  return m ? Math.ceil(parseFloat(m[1])) + 3 : 65;
}

// ── System prompt ─────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a game analytics expert advising Level Designers of LILA BLACK (an extraction shooter on mobile).
You receive a ZONE GRAPH — a 3×3 grid of named map regions with aggregated player telemetry and zone-to-zone relationship edges.
Your job: reason over the graph structure and give actionable map design recommendations.

Return ONLY valid JSON — no markdown, no code fences, no extra text.

JSON schema (strict):
{
  "text": "2-3 sentence analysis reasoning over zone relationships and patterns",
  "insight": "ONE actionable design tip starting with a verb (Add / Reduce / Move / Widen / Place / Remove / Reroute)",
  "charts": [
    {
      "type": "bar",
      "title": "Short chart title (e.g. 'Kills by Zone')",
      "color": "#hex",
      "data": [{"label": "Zone name", "value": 42}]
    }
  ],
  "zones": [
    {"x": -120, "z": 200, "radius": 80, "label": "Zone name", "color": "#ef4444"}
  ]
}

Rules:
- Always include 1-2 charts using the zone names from the graph as labels. Max 8 data points.
- zones: use the worldX,worldZ coordinates from the node list. Max 5 zones. Omit if not relevant.
- chart colors: #ef4444=kills/danger, #ff8a00=traffic/hotdrop, #22c55e=loot, #a855f7=storm, #60a5fa=human, #818cf8=bot
- insight must reference specific zones by name and be a concrete actionable change
- Use zone relationship edges to reason about chokepoints, flow, and contested areas`;

// ── API keys ──────────────────────────────────────────────────────────────────

export const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
export const ENV_KEY  = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// ── Model constants ───────────────────────────────────────────────────────────

const GROQ_MODEL    = 'llama-3.3-70b-versatile';
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'] as const;

// ── API callers ───────────────────────────────────────────────────────────────

export async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.3,
    }),
  });
  const json = await res.json();
  if (res.ok) return json.choices?.[0]?.message?.content ?? '{}';
  throw new Error(json.error?.message ?? `HTTP ${res.status}`);
}

export async function callGemini(apiKey: string, prompt: string): Promise<string> {
  let lastErr = '';
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0.3 },
        }),
      }
    );
    const json = await res.json();
    if (res.ok) return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const retryDelay: string = json.error?.details?.find((d: any) => d.retryDelay)?.retryDelay ?? '';
    lastErr = `${json.error?.message ?? `HTTP ${res.status}`}${retryDelay ? ` retry in ${retryDelay}` : ''}`;
    if (res.status === 401 || res.status === 403) break;
  }
  throw new Error(lastErr);
}

export async function callAI(geminiKey: string, prompt: string): Promise<string> {
  if (GROQ_KEY) return callGroq(GROQ_KEY, prompt);
  return callGemini(geminiKey, prompt);
}

// ── Response parser ───────────────────────────────────────────────────────────

export function parseAIResponse(raw: string): {
  text: string;
  insight?: string;
  charts?: AiChart[];
  zones?: AiHighlightZone[];
} {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const zones: AiHighlightZone[] = (parsed.zones ?? []).map((z: any) => ({
      x: Number(z.x), z: Number(z.z),
      radius: Number(z.radius ?? 60),
      label: String(z.label ?? ''),
      color: z.color ?? '#ff8a00',
    }));
    const charts: AiChart[] = (parsed.charts ?? []).slice(0, 2).map((c: any) => ({
      type: c.type === 'radar' ? 'radar' : 'bar',
      title: String(c.title ?? ''),
      color: c.color,
      data: (c.data ?? []).slice(0, 8).map((d: any) => ({
        label: String(d.label ?? ''),
        value: Number(d.value ?? 0),
      })),
    }));
    return {
      text: String(parsed.text ?? raw),
      insight: parsed.insight ? String(parsed.insight) : undefined,
      charts:  charts.length > 0 ? charts : undefined,
      zones:   zones.length > 0  ? zones  : undefined,
    };
  } catch {
    return { text: raw };
  }
}

// ── Demo responses (shown when no API key is configured) ─────────────────────

type DemoSlot = { text: string; insight: string; charts: AiChart[]; zones: AiHighlightZone[] };
type DemoBank = { kills?: DemoSlot; loot?: DemoSlot; storm?: DemoSlot; default: DemoSlot };

const DEMO: Record<string, DemoBank> = {
  AmbroseValley: {
    kills: {
      text: 'Central zone leads with 47 kills across 566 matches — 2.4× the next highest zone. The kill_corridor between Central and East (68 combined kills) shows that players rotating east are consistently caught in open ground.',
      insight: 'Add 2–3 rock formations along the Central–East boundary to break sightlines and push engagements into adjacent zones rather than the same open corridor.',
      charts: [{ type: 'bar', title: 'Kills by Zone', color: '#ef4444', data: [{ label: 'Central', value: 47 }, { label: 'East', value: 21 }, { label: 'North', value: 18 }, { label: 'NE Corner', value: 12 }, { label: 'South', value: 9 }] }],
      zones: [{ x: 80, z: -23, radius: 90, label: 'Central — kill hotspot', color: '#ef4444' }, { x: 380, z: -23, radius: 70, label: 'East — kill corridor exit', color: '#f97316' }],
    },
    loot: {
      text: 'Loot is concentrated in the North and Central zones with minimal pickups in SW and SE corners. Players are routing through a narrow north-central corridor, leaving roughly 40% of the map\'s loot untouched across all matches.',
      insight: 'Redistribute 15–20% of high-value loot from the Central zone into the SW Corner and South zones to encourage varied routing and extend meaningful player engagement.',
      charts: [{ type: 'bar', title: 'Loot Pickups by Zone', color: '#22c55e', data: [{ label: 'North', value: 89 }, { label: 'Central', value: 76 }, { label: 'East', value: 43 }, { label: 'NE Corner', value: 38 }, { label: 'SW Corner', value: 11 }] }],
      zones: [{ x: 80, z: 277, radius: 80, label: 'North — loot-dense', color: '#22c55e' }, { x: -220, z: -323, radius: 70, label: 'SW Corner — underutilised', color: '#60a5fa' }],
    },
    default: {
      text: '78% of all human position samples occur in a diagonal band from NW Corner through Central to SE Corner. The West and SW zones record near-zero human traffic despite containing loot spawns, suggesting players have learned to route around them entirely.',
      insight: 'Place a high-value extraction point in the West zone to pull players off the predictable NW–Central–SE diagonal and create meaningful routing decisions.',
      charts: [{ type: 'bar', title: 'Human Traffic by Zone', color: '#ff8a00', data: [{ label: 'Central', value: 3820 }, { label: 'NW Corner', value: 2910 }, { label: 'North', value: 2210 }, { label: 'SE Corner', value: 1980 }, { label: 'West', value: 340 }] }],
      zones: [{ x: 80, z: -23, radius: 90, label: 'Central — high traffic', color: '#ff8a00' }, { x: -220, z: -23, radius: 70, label: 'West — dead zone', color: '#60a5fa' }],
    },
  },
  GrandRift: {
    kills: {
      text: 'Grand Rift\'s Central zone accounts for 62% of all kills despite covering only 11% of map area. The tight geometry creates inescapable sightlines that funnel players into predictable, high-lethality engagements.',
      insight: 'Add vertical cover — elevated platforms or angled ramps — in the Central zone to reduce sightline length and give players options to break contact.',
      charts: [{ type: 'bar', title: 'Kills by Zone', color: '#ef4444', data: [{ label: 'Central', value: 38 }, { label: 'North', value: 14 }, { label: 'East', value: 11 }, { label: 'South', value: 7 }] }],
      zones: [{ x: 1, z: 1, radius: 80, label: 'Central — kill funnel', color: '#ef4444' }],
    },
    default: {
      text: 'Player paths on Grand Rift converge heavily in the Central zone with sparse coverage in NW and SE corners. The map\'s smaller scale means most engagements resolve before players can establish positional advantage.',
      insight: 'Widen the NW and SE corridors to distribute combat pressure across more of the map and reduce Central zone dominance in match outcomes.',
      charts: [{ type: 'bar', title: 'Human Traffic by Zone', color: '#ff8a00', data: [{ label: 'Central', value: 2140 }, { label: 'North', value: 1020 }, { label: 'East', value: 980 }, { label: 'South', value: 760 }, { label: 'NW Corner', value: 230 }] }],
      zones: [{ x: 1, z: 1, radius: 80, label: 'Central — traffic hub', color: '#ff8a00' }, { x: -193, z: 194, radius: 60, label: 'NW Corner — underutilised', color: '#60a5fa' }],
    },
  },
  Lockdown: {
    storm: {
      text: 'All storm deaths on Lockdown cluster in the South zone — the last area the storm circle reaches. Players routinely underestimate the final circle\'s speed, making the southern extraction route the most punishing path in the game.',
      insight: 'Add a clearly visible storm boundary indicator near the South extraction point to give players an earlier warning before storm damage begins.',
      charts: [{ type: 'bar', title: 'Storm Deaths by Zone', color: '#a855f7', data: [{ label: 'South', value: 24 }, { label: 'SW Corner', value: 9 }, { label: 'SE Corner', value: 6 }] }],
      zones: [{ x: 0, z: -333, radius: 90, label: 'South — storm death cluster', color: '#a855f7' }],
    },
    default: {
      text: 'Lockdown\'s compact layout creates intense Central zone congestion — 71% of all events occur in the Central-to-North corridor. The southern half records significantly lower traffic, leaving it as a viable safe rotation that experienced players exploit.',
      insight: 'Place a secondary objective or high-value loot cache in the SW Corner to pull players south, reduce Central-North congestion, and create more varied match patterns.',
      charts: [{ type: 'bar', title: 'Human Traffic by Zone', color: '#ff8a00', data: [{ label: 'Central', value: 2890 }, { label: 'North', value: 1740 }, { label: 'NE Corner', value: 980 }, { label: 'South', value: 420 }, { label: 'SW Corner', value: 180 }] }],
      zones: [{ x: 0, z: 0, radius: 90, label: 'Central — congested', color: '#ff8a00' }, { x: -333, z: -333, radius: 70, label: 'SW Corner — low traffic', color: '#60a5fa' }],
    },
  },
};

export function getDemoResponse(question: string, map: string): ReturnType<typeof parseAIResponse> {
  const q = question.toLowerCase();
  const bank: DemoBank = DEMO[map] ?? DEMO.AmbroseValley;
  let slot: DemoSlot;
  if      (q.match(/kill|kd|danger|choke|combat/)) slot = bank.kills   ?? bank.default;
  else if (q.match(/loot|item|pick/))              slot = bank.loot    ?? bank.default;
  else if (q.match(/storm|shrink|circle/))         slot = bank.storm   ?? bank.default;
  else                                              slot = bank.default;
  return {
    text:    slot.text,
    insight: slot.insight,
    charts:  slot.charts,
    zones:   slot.zones,
  };
}
