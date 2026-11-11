import { SimpleSpriteAssembler } from "./simple.ts";

export class SpriteAssemblerManager {
  static getAssembler(type: "SIMPLE"): SimpleSpriteAssembler {
    console.log("Sprite.Assembler.getAssembler -> " + type);
    return new SimpleSpriteAssembler();
  }
}
