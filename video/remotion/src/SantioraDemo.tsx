import { AbsoluteFill, Sequence } from "remotion";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Problem } from "./scenes/Scene2Problem";
import { Scene2bWhySomnia } from "./scenes/Scene2bWhySomnia";
import { Scene3Architecture } from "./scenes/Scene3Architecture";
import { Scene4AgentToAgent } from "./scenes/Scene4AgentToAgent";
import { Scene5Closing } from "./scenes/Scene5Closing";

export const SantioraDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <Sequence from={0} durationInFrames={150}>
        <Scene1Intro />
      </Sequence>
      <Sequence from={150} durationInFrames={750}>
        <Scene2Problem />
      </Sequence>
      <Sequence from={900} durationInFrames={750}>
        <Scene2bWhySomnia />
      </Sequence>
      <Sequence from={1650} durationInFrames={600}>
        <Scene3Architecture />
      </Sequence>
      <Sequence from={2250} durationInFrames={600}>
        <Scene4AgentToAgent />
      </Sequence>
      <Sequence from={2850} durationInFrames={150}>
        <Scene5Closing />
      </Sequence>
    </AbsoluteFill>
  );
};
