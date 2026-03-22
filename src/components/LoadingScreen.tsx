import React, { useEffect, useState, useRef } from 'react';

const BOOT_LINES = [
  { text: 'INITIALIZING TELEMETRY SYSTEM',  ms: 200  },
  { text: 'LOADING 796 MATCH RECORDS',       ms: 600  },
  { text: 'CALIBRATING MAP COORDINATES',     ms: 1000 },
  { text: 'BUILDING ANALYTICS GRID',         ms: 1400 },
  { text: 'SYNCING PLAYER TRAJECTORIES',     ms: 1750 },
];

const MIN_DISPLAY_MS = 3000;

export function LoadingScreen({ dataReady, onDone }: { dataReady: boolean; onDone: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [allLinesReady, setAllLinesReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const startRef = useRef(Date.now());
  const doneCalledRef = useRef(false);

  // Animate progress bar over MIN_DISPLAY_MS
  useEffect(() => {
    const start = startRef.current;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / MIN_DISPLAY_MS) * 100));
      if (elapsed < MIN_DISPLAY_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        setAllLinesReady(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Stagger boot lines
  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // Trigger fade-out when both data and min time are done
  useEffect(() => {
    if (dataReady && allLinesReady && !doneCalledRef.current) {
      doneCalledRef.current = true;
      setFadeOut(true);
      setTimeout(onDone, 600);
    }
  }, [dataReady, allLinesReady, onDone]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: '#07060b',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      {/* Scanlines */}
      <div className="scanlines absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Corner brackets */}
      {[
        { top: 16, left: 16,  borderWidth: '2px 0 0 2px' },
        { top: 16, right: 16, borderWidth: '2px 2px 0 0' },
        { bottom: 16, left: 16,  borderWidth: '0 0 2px 2px' },
        { bottom: 16, right: 16, borderWidth: '0 2px 2px 0' },
      ].map((s, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            ...s,
            width: 32, height: 32,
            borderStyle: 'solid',
            borderColor: 'rgba(255,138,0,0.5)',
          }}
        />
      ))}

      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,138,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,138,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          zIndex: 0,
        }}
      />

      {/* Center content */}
      <div className="relative flex flex-col items-center" style={{ zIndex: 2 }}>

        {/* Logo icon */}
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #ff8a00, #ff5500)',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
            boxShadow: '0 0 40px rgba(255,138,0,0.4)',
          }}
        >
          <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
            <path d="M3 3L9 15L15 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 9H12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: '0.22em',
            color: '#fff',
            textTransform: 'uppercase',
            lineHeight: 1,
            textShadow: '0 0 30px rgba(255,138,0,0.3)',
          }}
        >
          LILA <span style={{ color: '#ff8a00' }}>BLACK</span>
        </div>

        {/* Subtitle */}
        <div
          className="font-mono mt-1 mb-8"
          style={{
            fontSize: 9,
            letterSpacing: '0.35em',
            color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase',
          }}
        >
          Player Journey Visualizer
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 320,
            height: 2,
            background: 'rgba(255,255,255,0.07)',
            position: 'relative',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #ff5500, #ff8a00)',
              boxShadow: '0 0 10px rgba(255,138,0,0.7)',
              transition: 'width 0.05s linear',
            }}
          />
          {/* Glow dot at tip */}
          {progress > 0 && progress < 100 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: `${progress}%`,
                transform: 'translate(-50%, -50%)',
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#ff8a00',
                boxShadow: '0 0 8px 2px rgba(255,138,0,0.8)',
              }}
            />
          )}
        </div>

        {/* Boot lines */}
        <div style={{ width: 320, minHeight: 90 }}>
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => {
            const isLast = i === visibleLines - 1 && visibleLines < BOOT_LINES.length;
            const isDone = i < visibleLines - 1 || allLinesReady;
            return (
              <div
                key={line.text}
                className="font-mono flex items-center gap-2"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  color: isDone ? 'rgba(255,255,255,0.35)' : 'rgba(255,138,0,0.9)',
                  marginBottom: 5,
                  animation: `fadeInLine 0.2s ease forwards`,
                }}
              >
                <span style={{ color: isDone ? 'rgba(52,211,153,0.7)' : 'rgba(255,138,0,0.6)', width: 10 }}>
                  {isDone ? '✓' : '>'}
                </span>
                {line.text}
                {isLast && (
                  <span style={{ color: '#ff8a00', animation: 'blink 0.8s step-end infinite' }}>_</span>
                )}
              </div>
            );
          })}

          {/* READY state */}
          {allLinesReady && dataReady && (
            <div
              className="font-mono flex items-center gap-2 mt-1"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#34d399',
                animation: 'fadeInLine 0.3s ease forwards',
              }}
            >
              <span>■</span> SYSTEM READY
            </div>
          )}
        </div>

        {/* Bottom version tag */}
        <div
          className="font-mono mt-8"
          style={{ fontSize: 8, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.1em' }}
        >
          796 MATCHES · 89,016 EVENTS · FEB 10–14 2026
        </div>
      </div>
    </div>
  );
}
