import { ParticleAsset } from "./cocos/particle-2d/particle-asset.ts";
import { SpriteFrame, Texture2D } from "./cocos/particle-2d/sprite-frame.ts";
import { ParticleSystem2D } from "./cocos/particle-2d/particle-system-2d.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += `${message}\n`; };

const asset = new ParticleAsset(
  "assets/particles/spark.plist",
  { maxParticles: 4, particleLifespan: 1.0, emissionRate: 4, emitterType: 0, textureFileName: "spark.png", speed: 4, gravityy: -2 },
  new SpriteFrame(new Texture2D("assets/particles/spark.png")),
);
const system = new ParticleSystem2D();
system.__preload(asset);
system.resetSystem();

log(`配置: max=${system.totalParticles}, life=${system.life}s, rate=${system.emissionRate}/s, speed=${system.speed}`);
for (let frame = 1; frame <= 6; frame += 1) {
  system.lateUpdate(0.3);
  const states = system._simulator.particles
    .map((particle) => `x=${particle.x.toFixed(1)} y=${particle.y.toFixed(1)} ttl=${particle.timeToLive.toFixed(1)}`)
    .join(" | ");
  log(`t=${(frame * 0.3).toFixed(1)}s active=${system._simulator.particles.length}: ${states}`);
}
