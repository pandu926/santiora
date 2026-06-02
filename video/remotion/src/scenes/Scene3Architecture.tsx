import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const LAYERS = [
  {
    title: "Somnia Agentic L1",
    items: ["inferToolsChat", "scheduleSubscriptionAtBlock", "Native Reactivity", "400ms Finality"],
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.05)",
    borderColor: "rgba(99,102,241,0.2)",
  },
  {
    title: "Smart Contracts",
    items: ["MarketFactory", "OracleConsensus", "LiquidityPool", "BettingEngine"],
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.05)",
    borderColor: "rgba(139,92,246,0.2)",
  },
  {
    title: "AI Agents",
    items: ["Market Creator", "Odds Analyzer", "Resolver Agent", "Liquidity Manager"],
    color: "#a855f7",
    bgColor: "rgba(168,85,247,0.05)",
    borderColor: "rgba(168,85,247,0.2)",
  },
  {
    title: "User Interface",
    items: ["Betting Dashboard", "Agent Arena", "Portfolio Tracker", "Analytics"],
    color: "#c026d3",
    bgColor: "rgba(192,38,211,0.05)",
    borderColor: "rgba(192,38,211,0.2)",
  },
];

const CARD_HEIGHT = 140;
const CARD_GAP = 24;
const HEADER_DURATION = 60;
const LAYER_INTERVAL = 90;
const ALL_LAYERS_VISIBLE = HEADER_DURATION + LAYERS.length * LAYER_INTERVAL;
const STACK_START = ALL_LAYERS_VISIBLE + 30;
const ENDING_START = STACK_START + 80;

export const Scene3Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = spring({ frame, fps, from: 30, to: 0, config: { damping: 14 } });

  const endingOpacity = interpolate(frame, [ENDING_START, ENDING_START + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const endingY = spring({ frame: Math.max(0, frame - ENDING_START), fps, from: 20, to: 0, config: { damping: 14 } });

  const isStacking = frame >= STACK_START;
  const stackProgress = isStacking
    ? interpolate(frame, [STACK_START, STACK_START + 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;

  const totalHeight = LAYERS.length * CARD_HEIGHT + (LAYERS.length - 1) * CARD_GAP;
  const baseTop = (1080 - totalHeight) / 2 + 30;

  const perspectiveRotateX = interpolate(stackProgress, [0, 1], [0, 12]);
  const perspectiveScale = interpolate(stackProgress, [0, 1], [1, 0.92]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 36, left: 0, right: 0,
        textAlign: "center",
        opacity: headerOpacity,
        transform: `translateY(${headerY}px)`,
        zIndex: 20,
      }}>
        <h2 style={{
          fontSize: 44, fontWeight: 800, color: "#09090b",
          letterSpacing: -1.5, marginBottom: 8,
          fontFamily: "Inter, sans-serif",
        }}>
          How Santiora Works
        </h2>
        <p style={{
          fontSize: 18, fontWeight: 400, color: "#52525b",
          fontFamily: "Inter, sans-serif",
        }}>
          Four layers, zero human operation
        </p>
      </div>

      {/* 3D perspective container */}
      <div style={{
        position: "absolute",
        left: 160, right: 160,
        top: baseTop,
        height: totalHeight,
        perspective: "1200px",
        transformStyle: "preserve-3d",
        transform: `rotateX(${perspectiveRotateX}deg) scale(${perspectiveScale})`,
        transformOrigin: "center center",
      }}>
        {/* Cards — flip in alternating from left/right */}
        {LAYERS.map((layer, i) => {
          const layerStart = HEADER_DURATION + i * LAYER_INTERVAL;
          const fromLeft = i % 2 === 0;

          const flipProgress = spring({
            frame: Math.max(0, frame - layerStart),
            fps,
            from: 0,
            to: 1,
            config: { damping: 12, stiffness: 80 },
          });

          const rotateY = interpolate(flipProgress, [0, 1], [fromLeft ? -90 : 90, 0]);
          const cardOpacity = interpolate(flipProgress, [0, 0.3, 1], [0, 1, 1]);

          const stackGap = interpolate(stackProgress, [0, 1], [0, -8 * i]);
          const shadowDepth = interpolate(stackProgress, [0, 1], [8, 24 + i * 8]);
          const shadowOpacity = interpolate(stackProgress, [0, 1], [0.06, 0.12 + i * 0.02]);

          if (frame < layerStart) return null;

          const cardTop = i * (CARD_HEIGHT + CARD_GAP) + stackGap;

          return (
            <div key={`layer-${i}`} style={{
              position: "absolute",
              left: 0, right: 0,
              top: cardTop,
              height: CARD_HEIGHT,
              opacity: cardOpacity,
              transform: `rotateY(${rotateY}deg)`,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              zIndex: 10 + i,
            }}>
              <div style={{
                width: "100%", height: "100%",
                background: layer.bgColor,
                border: `2px solid ${layer.borderColor}`,
                borderRadius: 16,
                padding: "20px 36px",
                display: "flex", flexDirection: "column",
                justifyContent: "center",
                boxShadow: `0 ${shadowDepth}px ${shadowDepth * 2}px rgba(0,0,0,${shadowOpacity})`,
                backdropFilter: "blur(8px)",
              }}>
                {/* Layer title */}
                <div style={{
                  fontSize: 24, fontWeight: 800, color: layer.color,
                  fontFamily: "Inter, sans-serif",
                  marginBottom: 14,
                  letterSpacing: -0.5,
                }}>
                  {layer.title}
                </div>

                {/* Layer items — staggered */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {layer.items.map((item, j) => {
                    const itemDelay = j * 10;
                    const itemOpacity = interpolate(frame, [layerStart + 25 + itemDelay, layerStart + 40 + itemDelay], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                    const itemScale = spring({
                      frame: Math.max(0, frame - layerStart - 25 - itemDelay),
                      fps,
                      from: 0.8,
                      to: 1,
                      config: { damping: 14 },
                    });

                    return (
                      <div key={`item-${i}-${j}`} style={{
                        padding: "8px 16px",
                        background: "#ffffff",
                        border: `1.5px solid ${layer.borderColor}`,
                        borderRadius: 8,
                        fontSize: 15, fontWeight: 600, color: "#18181b",
                        fontFamily: "JetBrains Mono, monospace",
                        opacity: itemOpacity,
                        transform: `scale(${itemScale})`,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                      }}>
                        {item}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ending statement */}
      {frame >= ENDING_START && (
        <div style={{
          position: "absolute",
          bottom: 40,
          left: 0, right: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 8,
          opacity: endingOpacity,
          transform: `translateY(${endingY}px)`,
          zIndex: 30,
        }}>
          <div style={{
            fontSize: 26, fontWeight: 800, color: "#09090b",
            fontFamily: "Inter, sans-serif", letterSpacing: -0.5,
          }}>
            Fully autonomous from bottom to top
          </div>
          <div style={{
            fontSize: 15, fontWeight: 400, color: "#71717a",
            fontFamily: "Inter, sans-serif",
          }}>
            No admin keys, no governance, no human operators — AI IS the protocol
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
