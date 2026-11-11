import { Technique } from "../../../renderer/core/technique.ts";
import { Pass } from "../../../renderer/core/pass.ts";

export class Effect {
  private currentTechnique: Technique;

  constructor(
    readonly name: string,
    readonly techniques: Technique[],
    techniqueIndex = 0,
  ) {
    this.currentTechnique = techniques[techniqueIndex];
  }

  get technique(): Technique {
    return this.currentTechnique;
  }

  get passes(): Pass[] {
    return this.currentTechnique.passes;
  }

  switchTechnique(index: number): void {
    const technique = this.techniques[index];
    if (!technique) throw new Error("Technique index out of range");
    this.currentTechnique = technique;
  }

  clone(): Effect {
    return new Effect(this.name, this.techniques.map((technique) => technique.clone()),
      this.techniques.indexOf(this.currentTechnique));
  }
}
