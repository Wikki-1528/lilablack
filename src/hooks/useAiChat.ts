import { useState, useCallback, useEffect, useRef } from 'react';
import { useVisualizerStore } from '@/lib/store';
import { buildGraphContext, SUGGESTED } from '@/lib/aiGraph';
import { callAI, parseAIResponse, parseRetryAfter, getDemoResponse, ENV_KEY, SYSTEM_PROMPT } from '@/lib/aiApi';

export function useAiChat(map: string) {
  const { analyticsData, geminiApiKey, addAiMessage, setAiHighlightZones } = useVisualizerStore();

  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [retryIn, setRetryIn]       = useState(0);
  const [pendingQ, setPendingQ]     = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const askRef       = useRef<(q: string) => void>(() => {});

  const apiKey    = ENV_KEY || geminiApiKey;
  const data      = analyticsData[map];
  const suggested = SUGGESTED[map] ?? SUGGESTED.AmbroseValley;

  const ask = useCallback(async (question: string) => {
    if (!question.trim() || loading || retryIn > 0 || !data) return;
    addAiMessage({ role: 'user', content: question });
    setInput('');
    setLoading(true);

    // Demo mode — no API key configured
    if (!apiKey) {
      await new Promise(r => setTimeout(r, 900));
      const parsed = getDemoResponse(question, map);
      addAiMessage({ role: 'assistant', content: parsed.text, insight: parsed.insight, charts: parsed.charts, zones: parsed.zones });
      if (parsed.zones?.length) setAiHighlightZones(parsed.zones);
      setLoading(false);
      return;
    }

    const context = buildGraphContext(question, data, map);
    const prompt  = `${SYSTEM_PROMPT}\n\nZONE GRAPH DATA:\n${context}\n\nQUESTION: ${question}`;
    try {
      const raw    = await callAI(apiKey, prompt);
      const parsed = parseAIResponse(raw);
      addAiMessage({
        role: 'assistant',
        content: parsed.text,
        insight: parsed.insight,
        charts:  parsed.charts,
        zones:   parsed.zones,
      });
      if (parsed.zones?.length) setAiHighlightZones(parsed.zones);
    } catch (err: any) {
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('quota') || msg.includes('429')) {
        setPendingQ(question);
        setRetryCount(c => c + 1);
        setRetryIn(parseRetryAfter(msg));
      } else {
        addAiMessage({ role: 'assistant', content: `Error: ${msg}`, error: true });
      }
    } finally {
      setLoading(false);
    }
  }, [loading, retryIn, apiKey, data, map, addAiMessage, setAiHighlightZones]);

  // Keep ref up-to-date so the retry effect can call the latest ask
  askRef.current = ask;

  useEffect(() => {
    if (retryIn <= 0) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pendingQ && retryCount < 2) {
        askRef.current(pendingQ);
        setPendingQ('');
      } else if (pendingQ) {
        addAiMessage({
          role: 'assistant',
          content: 'Error: Daily API quota exhausted. Please try again tomorrow or use a different project key.',
          error: true,
        });
        setPendingQ('');
        setRetryCount(0);
      }
      return;
    }
    countdownRef.current = setInterval(() => setRetryIn(r => r - 1), 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [retryIn]);

  return { input, setInput, loading, retryIn, pendingQ, ask, data, suggested, apiKey };
}

export type AiChatHook = ReturnType<typeof useAiChat>;
