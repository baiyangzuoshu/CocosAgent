import { ParticleAsset } from "./cocos/particle-2d/particle-asset.ts";
import { SpriteFrame, Texture2D } from "./cocos/particle-2d/sprite-frame.ts";
import { ParticleSystem2D } from "./cocos/particle-2d/particle-system-2d.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += `${message}\n`; };

const asset = new ParticleAsset(
  "assets/particles/spark.plist",
  { maxParticles: 24, particleLifespan: 1.5, emissionRate: 16, emitterType: 0, textureFileName: "spark.png" },
  new SpriteFrame(new Texture2D("assets/particles/spark.png")),
);
const system = new ParticleSystem2D();
system.__preload(asset);

log(`ParticleAsset: ${asset.nativeUrl}`);
log(`配置: totalParticles=${system.totalParticles}, life=${system.life}s, emissionRate=${system.emissionRate}/s, mode=${system.emitterMode}`);
log(`SpriteFrame: ${system.spriteFrame?.texture.url}`);
log(`Simulator: active particles=${system._simulator.particles.length}（本课尚未发射）`);
