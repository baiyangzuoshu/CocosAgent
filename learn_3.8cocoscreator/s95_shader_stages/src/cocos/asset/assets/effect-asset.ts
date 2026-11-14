export interface EffectSource { name: string; vertex: string; fragment: string; }
/** EffectAsset holds the selected pass stages used by this 3.8 sample. */
export class EffectAsset {
  selectProgram(effect: EffectSource): EffectSource {
    if (!effect.vertex.includes("void main") || !effect.fragment.includes("void main")) throw new Error("Effect pass needs vert and frag entry points");
    console.log(`Effect ${effect.name}: pass selects vert and frag programs`);
    return effect;
  }
}
