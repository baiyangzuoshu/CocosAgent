export interface EffectSource { name: string; vertex: string; fragment: string; }
export class EffectParser {
  parse(effect: EffectSource): EffectSource {
    if (!effect.vertex.includes("void main") || !effect.fragment.includes("void main")) {
      throw new Error("Effect needs a vertex and fragment entry point");
    }
    console.log(`Effect ${effect.name}: vert and frag are separate Shader stages`);
    return effect;
  }
}
