import { Composition } from "remotion";
import { SantioraDemo } from "./SantioraDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SantioraDemo"
        component={SantioraDemo}
        durationInFrames={3000}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
