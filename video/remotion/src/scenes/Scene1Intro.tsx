import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

const NUM_PARTICLES = 25;

function generateParticles(seed: number) {
  const particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const angle = (i / NUM_PARTICLES) * Math.PI * 2 + seed;
    const radius = 300 + (i % 5) * 80;
    const startX = Math.cos(angle) * radius;
    const startY = Math.sin(angle) * radius;
    const size = 6 + (i % 4) * 3;
    const opacity = 0.4 + (i % 3) * 0.2;
    const color = i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#8b5cf6" : "#a78bfa";
    particles.push({ startX, startY, size, opacity, color, delay: i * 1.5 });
  }
  return particles;
}

const PARTICLES = generateParticles(0.7);

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const convergeProgress = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  const logoScale = spring({ frame: Math.max(0, frame - 55), fps, from: 0, to: 1, config: { damping: 10, stiffness: 100 } });
  const logoOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  const glowOpacity = interpolate(frame, [60, 75, 90], [0, 0.6, 0.2], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  const titleOpacity = interpolate(frame, [80, 95], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const titleY = spring({ frame: Math.max(0, frame - 78), fps, from: 30, to: 0, config: { damping: 14 } });

  const subtitleOpacity = interpolate(frame, [100, 115], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const subtitleY = spring({ frame: Math.max(0, frame - 98), fps, from: 25, to: 0, config: { damping: 14 } });

  const badgeOpacity = interpolate(frame, [120, 135], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const badgeY = spring({ frame: Math.max(0, frame - 118), fps, from: 20, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Particles */}
      {PARTICLES.map((p, i) => {
        const particleX = interpolate(convergeProgress, [0, 1], [p.startX, 0]);
        const particleY = interpolate(convergeProgress, [0, 1], [p.startY, 0]);
        const particleOpacity = interpolate(frame, [0, 10 + p.delay, 50, 65], [0, p.opacity, p.opacity, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
        const particleScale = interpolate(convergeProgress, [0, 0.8, 1], [1, 1, 0.3]);

        return (
          <div key={i} style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            filter: `blur(${p.size > 10 ? 3 : 1}px)`,
            opacity: particleOpacity,
            transform: `translate(${particleX - p.size / 2}px, ${particleY - p.size / 2}px) scale(${particleScale})`,
          }} />
        );
      })}

      {/* Glow burst when logo appears */}
      <div style={{
        position: "absolute",
        width: 200,
        height: 200,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
        opacity: glowOpacity,
        transform: `scale(${1 + glowOpacity})`,
      }} />

      {/* Logo */}
      <div style={{
        position: "absolute",
        transform: `scale(${logoScale})`,
        opacity: logoOpacity,
      }}>
        <Img src={staticFile("logo-santiora.png")} style={{ width: 100, height: 100, borderRadius: 20 }} />
      </div>

      {/* Text content */}
      <div style={{ position: "absolute", top: "58%", textAlign: "center", zIndex: 1 }}>
        {/* Title */}
        <h1 style={{
          fontSize: 64,
          fontWeight: 700,
          color: "#09090b",
          letterSpacing: -2,
          marginBottom: 16,
          fontFamily: "Inter, -apple-system, sans-serif",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}>
          Santiora
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 22,
          fontWeight: 400,
          color: "#52525b",
          letterSpacing: 0.3,
          marginBottom: 40,
          fontFamily: "Inter, -apple-system, sans-serif",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
        }}>
          Fully Autonomous AI Prediction Market
        </p>

        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 24px",
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 100,
          color: "#6366f1",
          fontSize: 14,
          fontWeight: 500,
          fontFamily: "Inter, -apple-system, sans-serif",
          opacity: badgeOpacity,
          transform: `translateY(${badgeY}px)`,
        }}>
          <span style={{ width: 8, height: 8, background: "#22c55e", borderRadius: "50%" }} />
          Built on Somnia Agentic L1
        </div>
      </div>
    </AbsoluteFill>
  );
};
