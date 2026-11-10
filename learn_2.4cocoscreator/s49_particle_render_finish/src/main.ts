import { ParticleAsset, SpriteFrame, Texture2D } from "./cocos2d/particle/CCParticleAsset.ts";
import { ParticleSystem } from "./cocos2d/particle/CCParticleSystem.ts";
import { WebRenderer } from "./cocos2d/particle/particle-renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const asset = new ParticleAsset(
  "assets/particles/spark.plist",
  { maxParticles: 4, particleLifespan: 1.0, emissionRate: 4, emitterType: 0, textureFileName: "spark.png", speed: 4, gravityy: -2 },
  new SpriteFrame(new Texture2D("assets/particles/spark.png")),
);
const system = new ParticleSystem();
system.__preload(asset);
system.resetSystem();
const renderer = new WebRenderer();

for (let frame = 1; frame <= 7 && !system.nodeDestroyed; frame += 1) {
  if (frame === 3) system.stopSystem();
  system.lateUpdate(0.3);
  system.render(renderer);
  const data = system._assembler.buffer;
  log("t=" + (frame * 0.3).toFixed(1) + "s active=" + system._simulator.particles.length
    + " vertices=" + data.vertexCount + " indices=" + data.indexCount
    + " flushes=" + renderer.submissions + " removed=" + system.nodeDestroyed);
}
