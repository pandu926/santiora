import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

const AGENTS = [
  { id: "creator", name: "Market Creator", desc: "Detects events", x: 360, y: 280 },
  { id: "odds", name: "Odds Analyzer", desc: "Sets probability", x: 1560, y: 280 },
  { id: "resolver", name: "Resolver Agent", desc: "Verifies outcomes", x: 1560, y: 760 },
  { id: "liquidity", name: "Liquidity Mgr", desc: "Manages pools", x: 360, y: 760 },
  { id: "consensus", name: "Consensus Hub", desc: "Cross-check oracle", x: 960, y: 520 },
];

const EDGES = [
  { from: 0, to: 4, label: "new market" },
  { from: 4, to: 1, label: "price signal" },
  { from: 1, to: 4, label: "odds update" },
  { from: 4, to: 2, label: "resolve request" },
  { from: 2, to: 4, label: "outcome proof" },
  { from: 4, to: 3, label: "rebalance" },
  { from: 3, to: 4, label: "pool status" },
  { from: 0, to: 1, label: "event feed" },
  { from: 1, to: 2, label: "verify odds" },
  { from: 2, to: 3, label: "settle pool" },
  { from: 3, to: 0, label: "fund market" },
];

const NODE_APPEAR_START = 40;
const NODE_INTERVAL = 50;
const EDGE_START = NODE_APPEAR_START + AGENTS.length * NODE_INTERVAL + 30;
const EDGE_INTERVAL = 40;
const PARTICLE_LOOP_START = EDGE_START + EDGES.length * EDGE_INTERVAL + 40;
const ENDING_START = PARTICLE_LOOP_START + 120;

const COLORS: Record<string, string> = {
  creator: "#6366f1",
  odds: "#8b5cf6",
  resolver: "#a855f7",
  liquidity: "#ec4899",
  consensus: "#f59e0b",
};

export const Scene4AgentToAgent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const endingOpacity = interpolate(frame, [ENDING_START, ENDING_START + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const endingY = spring({ frame: Math.max(0, frame - ENDING_START), fps, from: 20, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 36, left: 0, right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${spring({ frame, fps, from: 30, to: 0, config: { damping: 14 } })}px)`,
        zIndex: 20,
      }}>
        <h2 style={{
          fontSize: 44, fontWeight: 800, color: "#09090b",
          letterSpacing: -1.5, marginBottom: 8,
          fontFamily: "Inter, sans-serif",
        }}>
          Agent-to-Agent Communication
        </h2>
        <p style={{
          fontSize: 18, fontWeight: 400, color: "#52525b",
          fontFamily: "Inter, sans-serif",
        }}>
          Autonomous cross-check consensus — no human in the loop
        </p>
      </div>

      {/* SVG layer for edges and particles */}
      <svg style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} viewBox="0 0 1920 1080">
        <defs>
          <linearGradient id="edgeGrad4" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99,102,241,0.7)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0.7)" />
          </linearGradient>
          <filter id="particleGlow4">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {EDGES.map((edge, i) => {
          const edgeAppear = EDGE_START + i * EDGE_INTERVAL;
          const edgeOpacity = interpolate(frame, [edgeAppear, edgeAppear + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          if (frame < edgeAppear) return null;

          const fromNode = AGENTS[edge.from];
          const toNode = AGENTS[edge.to];

          const pulseOpacity = frame >= PARTICLE_LOOP_START
            ? 0.5 + 0.4 * Math.abs(Math.sin((frame - PARTICLE_LOOP_START + i * 15) * 0.04))
            : 0.7;

          const cycleLength = 120;
          const offset = i * 17;
          const t = frame >= PARTICLE_LOOP_START
            ? ((frame - PARTICLE_LOOP_START + offset) % cycleLength) / cycleLength
            : 0;
          const px = fromNode.x + (toNode.x - fromNode.x) * t;
          const py = fromNode.y + (toNode.y - fromNode.y) * t;

          const mx = (fromNode.x + toNode.x) / 2;
          const my = (fromNode.y + toNode.y) / 2;
          const labelOpacity = interpolate(frame, [edgeAppear + 15, edgeAppear + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

          return (
            <g key={`edge-${i}`} opacity={edgeOpacity}>
              <line
                x1={fromNode.x} y1={fromNode.y}
                x2={toNode.x} y2={toNode.y}
                stroke="url(#edgeGrad4)"
                strokeWidth={3.5}
                opacity={pulseOpacity}
              />
              {/* Particle */}
              {frame >= PARTICLE_LOOP_START && (
                <circle
                  cx={px} cy={py} r={5}
                  fill={i % 2 === 0 ? "#6366f1" : "#a855f7"}
                  filter="url(#particleGlow4)"
                  opacity={0.9}
                />
              )}
              {/* Edge label */}
              <text
                x={mx} y={my - 12}
                textAnchor="middle"
                fontSize={13}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                fill="#71717a"
                opacity={labelOpacity}
              >
                {edge.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Agent nodes */}
      {AGENTS.map((agent, i) => {
        const nodeStart = NODE_APPEAR_START + i * NODE_INTERVAL;
        const nodeOpacity = interpolate(frame, [nodeStart, nodeStart + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const nodeScale = spring({ frame: Math.max(0, frame - nodeStart), fps, from: 0.6, to: 1, config: { damping: 12, stiffness: 100 } });

        if (frame < nodeStart) return null;

        const color = COLORS[agent.id];
        const isActive = frame >= PARTICLE_LOOP_START;
        const ringPulse = isActive
          ? 1 + 0.05 * Math.sin((frame - PARTICLE_LOOP_START + i * 20) * 0.08)
          : 1;

        const size = agent.id === "consensus" ? 140 : 120;

        return (
          <div key={`agent-${i}`} style={{
            position: "absolute",
            left: agent.x,
            top: agent.y,
            transform: `translate(-50%, -50%) scale(${nodeScale * ringPulse})`,
            opacity: nodeOpacity,
            zIndex: 10,
          }}>
            {/* Outer ring */}
            <div style={{
              width: size,
              height: size,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              background: `radial-gradient(circle, ${color}15 0%, ${color}05 70%)`,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              boxShadow: isActive
                ? `0 0 24px ${color}40, 0 8px 32px rgba(0,0,0,0.08)`
                : `0 8px 32px rgba(0,0,0,0.06)`,
            }}>
              <div style={{
                fontSize: agent.id === "consensus" ? 14 : 13,
                fontWeight: 800,
                color: "#18181b",
                fontFamily: "Inter, sans-serif",
                textAlign: "center",
                lineHeight: 1.2,
                padding: "0 8px",
              }}>
                {agent.name}
              </div>
            </div>
            {/* Description below */}
            <div style={{
              position: "absolute",
              top: size + 10,
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: 14,
              fontWeight: 500,
              color: "#71717a",
              fontFamily: "Inter, sans-serif",
            }}>
              {agent.desc}
            </div>
          </div>
        );
      })}

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
            Multi-agent consensus without human intervention
          </div>
          <div style={{
            fontSize: 15, fontWeight: 400, color: "#71717a",
            fontFamily: "Inter, sans-serif",
          }}>
            Every decision cross-verified by independent AI agents before execution
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
