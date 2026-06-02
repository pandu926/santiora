import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";

const TAGLINE = "AI IS the protocol operator.";
const CTA_TEXT = "santiora.rbexp.com";

const PARTICLE_COUNT = 24;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const radius = 300 + Math.random() * 200;
  return {
    startX: Math.cos(angle) * radius,
    startY: Math.sin(angle) * radius,
    size: 3 + Math.random() * 5,
    delay: Math.floor(Math.random() * 20),
    color: i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#8b5cf6" : "#a855f7",
  };
});

const LOGO_APPEAR = 30;
const TITLE_START = 50;
const TAGLINE_START = 70;
const CTA_START = 110;
const BADGE_START = 125;

export const Scene5Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: Math.max(0, frame - LOGO_APPEAR), fps, from: 0.3, to: 1, config: { damping: 10, stiffness: 80 } });
  const logoOpacity = interpolate(frame, [LOGO_APPEAR, LOGO_APPEAR + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoGlow = interpolate(frame, [LOGO_APPEAR, LOGO_APPEAR + 30, LOGO_APPEAR + 60], [0, 0.6, 0.3], { extrapolateRight: "clamp" });

  const titleOpacity = interpolate(frame, [TITLE_START, TITLE_START + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = spring({ frame: Math.max(0, frame - TITLE_START), fps, from: 30, to: 0, config: { damping: 14 } });

  const typedChars = Math.min(
    TAGLINE.length,
    Math.max(0, Math.floor((frame - TAGLINE_START) * 0.8))
  );
  const taglineText = TAGLINE.slice(0, typedChars);
  const taglineOpacity = interpolate(frame, [TAGLINE_START, TAGLINE_START + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const ctaOpacity = interpolate(frame, [CTA_START, CTA_START + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ctaScale = spring({ frame: Math.max(0, frame - CTA_START), fps, from: 0.8, to: 1, config: { damping: 12 } });

  const badgeOpacity = interpolate(frame, [BADGE_START, BADGE_START + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeY = spring({ frame: Math.max(0, frame - BADGE_START), fps, from: 20, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa" }}>
      {/* Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Center glow */}
      <div style={{
        position: "absolute",
        left: 960 - 150, top: 540 - 150,
        width: 300, height: 300,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
        opacity: logoGlow,
        transform: `scale(${1.5 + logoGlow})`,
      }} />

      {/* Particles converging to center */}
      {PARTICLES.map((p, i) => {
        const progress = interpolate(frame, [p.delay, LOGO_APPEAR + p.delay], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const px = p.startX * (1 - progress);
        const py = p.startY * (1 - progress);
        const particleOpacity = interpolate(progress, [0, 0.3, 0.9, 1], [0, 0.8, 0.8, 0]);

        return (
          <div key={`particle-${i}`} style={{
            position: "absolute",
            left: 960 + px,
            top: 540 + py,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: particleOpacity,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: "translate(-50%, -50%)",
          }} />
        );
      })}

      {/* Logo */}
      {frame >= LOGO_APPEAR && (
        <div style={{
          position: "absolute",
          left: 960 - 80, top: 540 - 200,
          width: 160,
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          filter: `drop-shadow(0 0 ${20 + logoGlow * 40}px rgba(99,102,241,${0.2 + logoGlow * 0.3}))`,
        }}>
          <Img src={staticFile("logo-santiora.png")} style={{ width: 160, height: "auto" }} />
        </div>
      )}

      {/* Title */}
      {frame >= TITLE_START && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: 540 - 10,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}>
          <h1 style={{
            fontSize: 64, fontWeight: 800, color: "#09090b",
            letterSpacing: -2, marginBottom: 0,
            fontFamily: "Inter, sans-serif",
          }}>
            Santiora
          </h1>
          <p style={{
            fontSize: 20, fontWeight: 400, color: "#52525b",
            fontFamily: "Inter, sans-serif", marginTop: 12,
          }}>
            Fully Autonomous Prediction Market Protocol
          </p>
        </div>
      )}

      {/* Tagline — typewriter */}
      {frame >= TAGLINE_START && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: 540 + 110,
          textAlign: "center",
          opacity: taglineOpacity,
        }}>
          <span style={{
            fontSize: 28, fontWeight: 700, color: "#18181b",
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: -0.5,
          }}>
            {taglineText}
            {typedChars < TAGLINE.length && (
              <span style={{
                opacity: frame % 16 < 8 ? 1 : 0,
                color: "#6366f1",
              }}>|</span>
            )}
          </span>
        </div>
      )}

      {/* CTA */}
      {frame >= CTA_START && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: 540 + 170,
          textAlign: "center",
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
        }}>
          <div style={{
            display: "inline-block",
            padding: "14px 36px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: 12,
            fontSize: 20, fontWeight: 700, color: "#ffffff",
            fontFamily: "Inter, sans-serif",
            boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
          }}>
            {CTA_TEXT}
          </div>
        </div>
      )}

      {/* Badge */}
      {frame >= BADGE_START && (
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          bottom: 60,
          display: "flex", justifyContent: "center",
          opacity: badgeOpacity,
          transform: `translateY(${badgeY}px)`,
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "10px 24px",
            background: "rgba(99,102,241,0.05)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 100,
            fontSize: 15, fontWeight: 500, color: "#52525b",
            fontFamily: "Inter, sans-serif",
          }}>
            <span style={{ width: 8, height: 8, background: "#22c55e", borderRadius: "50%" }} />
            Built on Somnia Agentic L1 — 400ms finality
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
