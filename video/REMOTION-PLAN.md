# Remotion Video Production — Capabilities & Plan

## Available Effects

| Effect | Implementation |
|--------|---------------|
| Zoom in/out | `transform: scale(interpolate(frame, [0,30], [1, 1.5]))` |
| Pan/Focus | `transform: translate()` + scale to specific area |
| Fake cursor | Absolute positioned div animated along a path |
| Slow motion | `playbackRate` on `<Video>` component |
| Blur/Focus | `filter: blur(interpolate(...))` — blur bg, focus fg |
| Glow/Pulse | `box-shadow` animated with interpolate |
| Typewriter | String slice per frame |
| Lower thirds | Animated bar from bottom with text |
| Particle/Orbs | Multiple divs with blur + animated position |
| Split screen | Grid layout animated |
| Counter/Number | `Math.round(interpolate(...))` counting up |
| Highlight box | Animated border/glow around screen area |
| Fade + slide | TransitionSeries with fade/slide/wipe |
| Ken Burns | Slow zoom + pan on static image |
| Progress bar | Width animated across video duration |
| Stagger | Elements enter one by one with delay |
| 3D objects | Three.js via @remotion/three |
| Charts animated | Bar/pie charts with spring stagger |
| Lottie | Complex vector animations |
| Captions | TikTok-style synced subtitles |

## Remotion Packages Available

| Package | Purpose |
|---------|---------|
| `remotion` | Core — Composition, Sequence, interpolate, spring |
| `@remotion/transitions` | TransitionSeries — fade, slide, wipe, flip, clockWipe |
| `@remotion/three` | 3D content with Three.js |
| `@remotion/lottie` | Lottie animations |
| `@remotion/google-fonts` | Type-safe Google Fonts |
| `@remotion/captions` | TikTok-style captions |
| `@remotion/media` | Video/Audio embedding with trim, speed, volume |

## Key Rules

- ALL animations MUST use `useCurrentFrame()` — no CSS transitions, no Tailwind animate classes
- Use `<Img>` from remotion, not native `<img>`
- Use `<Video>` from `@remotion/media`, not native `<video>`
- Assets go in `public/` folder, referenced via `staticFile()`
- Spring configs: `{damping: 200}` smooth, `{damping: 20, stiffness: 200}` snappy, `{damping: 8}` bouncy
- TransitionSeries overlaps scenes — total duration is shorter than sum
- Always `extrapolateRight: 'clamp'` to prevent values going past target

## Video Production Plan

### Source Material

1. **Static scenes (already rendered):** Intro, Problem, Why Somnia, Architecture, Agent-to-Agent, Closing
2. **Playwright recordings (to capture):**
   - `/markets` — scroll through, show cards (10s)
   - `/markets/[active-susd]` — betting panel, odds (10s)
   - `/markets/[resolved]` — 100%/0% outcome (5s)
   - `/ai` — pipeline visualization, stats (10s)
   - `/activity` — real on-chain events (8s)

### Final Composition Structure (4 min = 7200 frames @ 30fps)

```
TransitionSeries:
  Scene 1: Intro (5s) — spring logo, fade text
    → fade transition (0.5s)
  Scene 2: Problem table (15s) — stagger rows
    → slide transition (0.5s)
  Scene 2b: Why Somnia (15s) — stagger cards
    → fade transition (0.5s)
  
  Screen Recording: /markets (15s)
    — zoom in to SUSD market card
    — highlight box glow
    — lower third: "AI-created markets, real on-chain data"
    → wipe transition (0.5s)
  
  Screen Recording: /markets/[detail] (15s)
    — fake cursor moves to YES button
    — zoom in to betting panel
    — lower third: "Bet with SUSD stablecoin"
    → fade transition (0.5s)
  
  Screen Recording: /markets/[resolved] (10s)
    — zoom in to outcome display (100%/0%)
    — highlight confidence score
    — lower third: "Resolved by AI consensus — 95% confidence"
    → slide transition (0.5s)
  
  Scene 3: Architecture (15s) — layers slide in
    → fade transition (0.5s)
  
  Screen Recording: /ai dashboard (15s)
    — zoom in to pipeline
    — counter animation overlay for stats
    — lower third: "Autonomous pipeline — zero human intervention"
    → wipe transition (0.5s)
  
  Scene 4: Agent-to-Agent (15s) — steps animate, verification box
    → fade transition (0.5s)
  
  Screen Recording: /activity (12s)
    — slow scroll through events
    — highlight TX link
    — lower third: "Every action verifiable on Somnia Explorer"
    → fade transition (0.5s)
  
  Gas Efficiency Chart (8s)
    — animated bar chart: 216,000 vs 96 fires/day
    — counter: "3000x more efficient"
    → fade transition (0.5s)
  
  Scene 5: Closing (5s) — spring logo, fade primitives, URL
```

### Effects Per Screen Recording

| Recording | Effects Applied |
|-----------|----------------|
| Markets page | Ken Burns (slow zoom), highlight box on SUSD badge |
| Market detail | Fake cursor → YES button, zoom to panel |
| Resolved market | Zoom to outcome, glow pulse on 95% |
| AI Dashboard | Zoom to pipeline, number counter overlay |
| Activity | Slow scroll, highlight TX hash, zoom to event |

### Rendering

```bash
npx remotion render src/index.tsx SantioraDemo output/santiora-final.mp4 --codec h264
```

Expected output: ~4 min, 1920x1080, 30fps, ~30-50MB
