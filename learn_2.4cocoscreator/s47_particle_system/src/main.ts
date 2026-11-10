import { ParticleAsset, SpriteFrame, Texture2D } from "./cocos2d/particle/CCParticleAsset.ts";
import { ParticleSystem } from "./cocos2d/particle/CCParticleSystem.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += `${message}\n`; };

const spriteFrame = new SpriteFrame(new Texture2D("assets/particles/spark.png"));
const asset = new ParticleAsset(
  "assets/particles/spark.plist",
  { maxParticles: 24, particleLifespan: 1.5, emissionRate: 16, emitterType: 0, textureFileName: "spark.png" },
  spriteFrame,
);
const system = new ParticleSystem();
system.__preload(asset);

log(`ParticleAsset: ${asset.nativeUrl}`);
log(`配置: maxParticles=${system.totalParticles}, life=${system.life}s, emissionRate=${system.emissionRate}/s, mode=${system.emitterMode}`);
log(`SpriteFrame: ${system.spriteFrame?.texture.url}`);
log(`Simulator: active particles=${system._simulator.particles.length}（本课尚未发射）`);
