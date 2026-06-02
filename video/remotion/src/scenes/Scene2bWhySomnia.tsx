import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

const CX = 960;
const CY = 540;
const RADIUS = 340;
const NODE_APPEAR_START = 60;
const NODE_INTERVAL = 65;
const ALL_VISIBLE_START = NODE_APPEAR_START + 6 * NODE_INTERVAL;
const ENDING_START = ALL_VISIBLE_START + 100;

const PRIMITIVES = [
  { name: "inferToolsChat", desc: "On-chain LLM inference", angle: -90 },
  { name: "scheduleSubscriptionAtBlock", desc: "One-shot block triggers", angle: -30 },
  { name: "Native Reactivity", desc: "Validator-guaranteed callbacks", angle: 30 },
  { name: "Agent Platform", desc: "Multi-agent orchestration", angle: 90 },
  { name: "400ms Finality", desc: "Sub-second blocks", angle: 150 },
  { name: "Agent-to-Agent", desc: "Cross-check consensus", angle: 210 },
];

export const Scene2bWhySomnia: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, from: 0, to: 1, config: { damping: 10, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const logoGlow = interpolate(frame, [0, 30, 55], [0, 0.6, 0.2], { extrapolateRight: "clamp" });

  const endingOpacity = interpolate(frame, [ENDING_START, ENDING_START + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const endingY = spring({ frame: Math.max(0, frame - ENDING_START), fps, from: 20, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Center glow */}
      <div style={{
        position: "absolute",
        left: CX - 120, top: CY - 120,
        width: 240, height: 240,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)",
        opacity: logoGlow,
        transform: `scale(${1.5 + logoGlow})`,
      }} />

      {/* Connecting lines — solid, thick, visible */}
      <svg style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} viewBox="0 0 1920 1080">
        {PRIMITIVES.map((p, i) => {
          const nodeStart = NODE_APPEAR_START + i * NODE_INTERVAL;
          const lineProgress = interpolate(frame, [nodeStart, nodeStart + 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const lineOpacity = interpolate(frame, [nodeStart, nodeStart + 12], [0, 0.7], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          if (frame < nodeStart) return null;

          const rad = (p.angle * Math.PI) / 180;
          const endX = CX + Math.cos(rad) * RADIUS * lineProgress;
          const endY = CY + Math.sin(rad) * RADIUS * lineProgress;

          return (
            <line
              key={`line-${i}`}
              x1={CX}
              y1={CY}
              x2={endX}
              y2={endY}
              stroke="url(#lineGradient)"
              strokeWidth={3}
              opacity={lineOpacity}
            />
          );
        })}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(139,92,246,0.6)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.2)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Logo Somnia at center */}
      <div style={{
        position: "absolute",
        left: CX - 80, top: CY - 45,
        width: 160,
        transform: `scale(${logoScale})`,
        opacity: logoOpacity,
        zIndex: 10,
        filter: `drop-shadow(0 0 ${20 + logoGlow * 40}px rgba(139,92,246,${0.2 + logoGlow * 0.3}))`,
      }}>
        <Img src={staticFile("logo-somnia.png")} style={{ width: 160, height: "auto" }} />
      </div>

      {/* Primitive nodes — absolute positioned at exact coordinates */}
      {PRIMITIVES.map((p, i) => {
        const nodeStart = NODE_APPEAR_START + i * NODE_INTERVAL;
        const nodeOpacity = interpolate(frame, [nodeStart, nodeStart + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const nodeScale = spring({ frame: Math.max(0, frame - nodeStart), fps, from: 0.8, to: 1, config: { damping: 12 } });

        if (frame < nodeStart) return null;

        const rad = (p.angle * Math.PI) / 180;
        const nodeX = CX + Math.cos(rad) * RADIUS;
        const nodeY = CY + Math.sin(rad) * RADIUS;

        const pulseOpacity = frame >= ALL_VISIBLE_START
          ? interpolate(frame, [ALL_VISIBLE_START, ALL_VISIBLE_START + 30, ALL_VISIBLE_START + 60], [0.8, 1, 0.8], { extrapolateRight: "clamp" })
          : 1;

        return (
          <div key={`node-${i}`} style={{
            position: "absolute",
            left: nodeX,
            top: nodeY,
            transform: `translate(-50%, -50%) scale(${nodeScale})`,
            opacity: nodeOpacity * pulseOpacity,
            zIndex: 5,
          }}>
            <div style={{
              padding: "14px 22px",
              background: "#ffffff",
              border: "2px solid rgba(139,92,246,0.25)",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(139,92,246,0.12)",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}>
              <div style={{
                fontSize: 22, fontWeight: 700, color: "#18181b",
                fontFamily: "JetBrains Mono, monospace",
                marginBottom: 5,
              }}>
                {p.name}
              </div>
              <div style={{
                fontSize: 16, fontWeight: 400, color: "#52525b",
                fontFamily: "Inter, sans-serif",
              }}>
                {p.desc}
              </div>
            </div>
          </div>
        );
      })}

      {/* Ending statement */}
      {frame >= ENDING_START && (
        <div style={{
          position: "absolute",
          bottom: 60,
          left: 0, right: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10,
          opacity: endingOpacity,
          transform: `translateY(${endingY}px)`,
          zIndex: 20,
        }}>
          <div style={{
            fontSize: 28, fontWeight: 800, color: "#09090b",
            fontFamily: "Inter, sans-serif", letterSpacing: -0.5,
          }}>
            Only possible on Somnia Agentic L1
          </div>
          <div style={{
            fontSize: 16, fontWeight: 400, color: "#71717a",
            fontFamily: "Inter, sans-serif",
          }}>
            Every core feature requires native primitives no other blockchain provides
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
