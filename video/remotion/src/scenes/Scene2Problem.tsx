import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const OLD_ITEMS = [
  { label: "Manual market creation", sub: "Polymarket / Augur require human teams" },
  { label: "Human reporters for resolution", sub: "UMA oracle relies on human voters" },
  { label: "Off-chain bots for automation", sub: "Chainlink Keepers / Gelato servers" },
  { label: "Trust centralized oracles", sub: "Single point of failure" },
  { label: "Servers running 24/7", sub: "External infrastructure required" },
  { label: "No on-chain AI reasoning", sub: "Off-chain APIs only" },
];

const NEW_ITEMS = [
  { label: "inferToolsChat", sub: "On-chain LLM creates markets autonomously" },
  { label: "Agent-to-Agent verification", sub: "Multi-AI consensus for resolution" },
  { label: "scheduleSubscriptionAtBlock", sub: "Self-rescheduling block triggers" },
  { label: "Trustless AI consensus", sub: "95% confidence threshold" },
  { label: "Zero external dependencies", sub: "Everything native on-chain" },
  { label: "On-chain Qwen3-30B", sub: "Native AI reasoning layer" },
];

const ITEM_DURATION = 42;
const FADE_IN = 10;
const FADE_OUT = 8;

const XIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const Scene2Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = spring({ frame, fps, from: 20, to: 0, config: { damping: 14 } });

  const oldPhaseStart = 30;
  const newPhaseStart = oldPhaseStart + OLD_ITEMS.length * ITEM_DURATION + 25;
  const endingStart = newPhaseStart + NEW_ITEMS.length * ITEM_DURATION + 10;
  const comparisonStart = endingStart + 50;

  const counterValue = frame >= endingStart
    ? Math.min(6, Math.round(interpolate(frame, [endingStart, endingStart + 20], [0, 6], { extrapolateRight: "clamp" })))
    : 0;

  const endingOpacity = interpolate(frame, [endingStart, endingStart + 12, comparisonStart - 8, comparisonStart], [0, 1, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const endingScale = spring({ frame: Math.max(0, frame - endingStart), fps, from: 0.9, to: 1, config: { damping: 12 } });

  const comparisonOpacity = interpolate(frame, [comparisonStart, comparisonStart + 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Header - visible at start, fades when items begin */}
      <div style={{
        position: "absolute", top: 80, left: 0, right: 0,
        textAlign: "center", zIndex: 1,
        opacity: interpolate(frame, [0, 20, oldPhaseStart - 5, oldPhaseStart + 5], [0, 1, 1, 0.3], { extrapolateRight: "clamp" }),
        transform: `translateY(${headerY}px)`,
      }}>
        <h2 style={{ fontSize: 44, fontWeight: 800, color: "#000000", letterSpacing: -1.5, marginBottom: 12, fontFamily: "Inter, sans-serif" }}>
          The Problem with Prediction Markets
        </h2>
        <p style={{ fontSize: 18, fontWeight: 500, color: "#3f3f46", fontFamily: "Inter, sans-serif" }}>
          Every platform today depends on humans and external infrastructure
        </p>
      </div>

      {/* OLD items - one at a time, full center */}
      {OLD_ITEMS.map((item, i) => {
        const itemStart = oldPhaseStart + i * ITEM_DURATION;
        const itemEnd = itemStart + ITEM_DURATION;

        const opacity = interpolate(
          frame,
          [itemStart, itemStart + FADE_IN, itemEnd - FADE_OUT, itemEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const scale = spring({
          frame: Math.max(0, frame - itemStart),
          fps,
          from: 0.92,
          to: 1,
          config: { damping: 14 },
        });

        const exitScale = frame > itemEnd - FADE_OUT
          ? interpolate(frame, [itemEnd - FADE_OUT, itemEnd], [1, 0.95], { extrapolateRight: "clamp" })
          : 1;

        if (frame < itemStart - 2 || frame > itemEnd + 2) return null;

        return (
          <div key={`old-${i}`} style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            opacity,
            transform: `scale(${scale * exitScale})`,
            zIndex: 10,
          }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: 14,
              background: "rgba(239,68,68,0.08)",
              border: "1.5px solid rgba(239,68,68,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <XIcon size={28} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 38, fontWeight: 700, color: "#18181b",
                letterSpacing: -0.8, marginBottom: 10,
                fontFamily: "Inter, sans-serif",
              }}>
                {item.label}
              </div>
              <div style={{
                fontSize: 18, color: "#71717a", fontWeight: 400,
                fontFamily: "Inter, sans-serif",
              }}>
                {item.sub}
              </div>
            </div>
            <div style={{
              marginTop: 8,
              padding: "6px 16px",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: "#dc2626",
              fontFamily: "Inter, sans-serif",
            }}>
              The Old Way
            </div>
          </div>
        );
      })}

      {/* Transition text between phases */}
      {(() => {
        const transStart = oldPhaseStart + OLD_ITEMS.length * ITEM_DURATION;
        const transEnd = newPhaseStart;
        const transOpacity = interpolate(
          frame,
          [transStart, transStart + 10, transEnd - 10, transEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        if (frame < transStart || frame > transEnd) return null;

        return (
          <div style={{
            position: "absolute",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            opacity: transOpacity, zIndex: 10,
          }}>
            <div style={{
              fontSize: 32, fontWeight: 600, color: "#6366f1",
              fontFamily: "Inter, sans-serif", letterSpacing: -0.5,
            }}>
              What if all of this was native?
            </div>
          </div>
        );
      })()}

      {/* NEW items - one at a time, full center */}
      {NEW_ITEMS.map((item, i) => {
        const itemStart = newPhaseStart + i * ITEM_DURATION;
        const itemEnd = itemStart + ITEM_DURATION;

        const opacity = interpolate(
          frame,
          [itemStart, itemStart + FADE_IN, itemEnd - FADE_OUT, itemEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const scale = spring({
          frame: Math.max(0, frame - itemStart),
          fps,
          from: 0.92,
          to: 1,
          config: { damping: 14 },
        });

        const exitScale = frame > itemEnd - FADE_OUT
          ? interpolate(frame, [itemEnd - FADE_OUT, itemEnd], [1, 0.95], { extrapolateRight: "clamp" })
          : 1;

        if (frame < itemStart - 2 || frame > itemEnd + 2) return null;

        return (
          <div key={`new-${i}`} style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            opacity,
            transform: `scale(${scale * exitScale})`,
            zIndex: 10,
          }}>
            <div style={{
              width: 56, height: 56,
              borderRadius: 14,
              background: "rgba(34,197,94,0.08)",
              border: "1.5px solid rgba(34,197,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckIcon size={28} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 38, fontWeight: 700, color: "#18181b",
                letterSpacing: -0.8, marginBottom: 10,
                fontFamily: "JetBrains Mono, monospace",
              }}>
                {item.label}
              </div>
              <div style={{
                fontSize: 18, color: "#71717a", fontWeight: 400,
                fontFamily: "Inter, sans-serif",
              }}>
                {item.sub}
              </div>
            </div>
            <div style={{
              marginTop: 8,
              padding: "6px 16px",
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.15)",
              borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: "#16a34a",
              fontFamily: "Inter, sans-serif",
            }}>
              The Santiora Way
            </div>
          </div>
        );
      })}

      {/* Ending - counter */}
      {frame >= endingStart - 2 && frame < comparisonStart && (
        <div style={{
          position: "absolute",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16,
          opacity: endingOpacity,
          transform: `scale(${endingScale})`,
          zIndex: 10,
        }}>
          <div style={{
            fontSize: 72, fontWeight: 800, color: "#6366f1",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: -2,
          }}>
            {counterValue}/6
          </div>
          <div style={{
            fontSize: 24, fontWeight: 600, color: "#09090b",
            fontFamily: "Inter, sans-serif",
          }}>
            operations — zero humans needed
          </div>
          <div style={{
            marginTop: 12,
            padding: "8px 20px",
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.15)",
            borderRadius: 8,
            fontSize: 14, fontWeight: 500, color: "#6366f1",
            fontFamily: "Inter, sans-serif",
          }}>
            Only possible on Somnia Agentic L1
          </div>
        </div>
      )}

      {/* Comparison summary - final 5 seconds */}
      {frame >= comparisonStart - 2 && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "60px 80px",
          opacity: comparisonOpacity,
          zIndex: 10,
        }}>
          {/* Comparison header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{
              fontSize: 32, fontWeight: 800, color: "#09090b",
              letterSpacing: -1, fontFamily: "Inter, sans-serif",
            }}>
              The Old Way vs The Santiora Way
            </h2>
          </div>

          {/* Two columns */}
          <div style={{ display: "flex", gap: 40, width: "100%", maxWidth: 1400 }}>
            {/* Left column - Old Way */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: "#dc2626",
                textTransform: "uppercase", letterSpacing: 1.5,
                marginBottom: 8, fontFamily: "Inter, sans-serif",
              }}>
                The Old Way
              </div>
              {OLD_ITEMS.map((item, i) => {
                const itemDelay = i * 8;
                const itemOpacity = interpolate(frame, [comparisonStart + itemDelay, comparisonStart + itemDelay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={`comp-old-${i}`} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.12)",
                    borderRadius: 10,
                    opacity: itemOpacity,
                  }}>
                    <XIcon size={18} />
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: "#09090b",
                      fontFamily: "Inter, sans-serif",
                    }}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right column - Santiora Way */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: "#16a34a",
                textTransform: "uppercase", letterSpacing: 1.5,
                marginBottom: 8, fontFamily: "Inter, sans-serif",
              }}>
                The Santiora Way
              </div>
              {NEW_ITEMS.map((item, i) => {
                const itemDelay = i * 8;
                const itemOpacity = interpolate(frame, [comparisonStart + itemDelay, comparisonStart + itemDelay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                return (
                  <div key={`comp-new-${i}`} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: "rgba(34,197,94,0.04)",
                    border: "1px solid rgba(34,197,94,0.12)",
                    borderRadius: 10,
                    opacity: itemOpacity,
                  }}>
                    <CheckIcon size={18} />
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: "#09090b",
                      fontFamily: "JetBrains Mono, monospace",
                    }}>
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
