import { ParticleAsset } from "./cocos/particle-2d/particle-asset.ts";
import { SpriteFrame, Texture2D } from "./cocos/particle-2d/sprite-frame.ts";
import { ParticleSystem2D } from "./cocos/particle-2d/particle-system-2d.ts";
import { ParticleBatcher } from "./cocos/particle-2d/particle-renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const asset = new ParticleAsset(
  "assets/particles/spark.plist",
  { maxParticles: 4, particleLifespan: 1.0, emissionRate: 4, emitterType: 0, textureFileName: "spark.png", speed: 4, gravityy: -2 },
  new SpriteFrame(new Texture2D("assets/particles/spark.png")),
);
const system = new ParticleSystem2D();
system.__preload(asset);
system.resetSystem();
const batcher = new ParticleBatcher();

for (let frame = 1; frame <= 7 && !system.nodeDestroyed; frame += 1) {
  if (frame === 3) system.stopSystem();
  system.lateUpdate(0.3);
  system._render(batcher);
  const data = system._simulator.renderData;
  log("t=" + (frame * 0.3).toFixed(1) + "s active=" + system._simulator.particles.length
    + " indices=" + (data?.indexCount ?? 0) + " commits=" + batcher.commits
    + " stopped=" + (frame >= 3) + " removed=" + system.nodeDestroyed
    + " renderDataRemoved=" + system._assembler.removedData);
}
