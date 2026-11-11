import { CCRenderComponent } from "./CCRenderComponent.ts";
import { Assembler, type SpriteData } from "../renderer/assembler.ts";
import { SimpleSpriteAssembler } from "../renderer/webgl/assemblers/sprite/2d/simple.ts";

export class CCSprite extends CCRenderComponent implements SpriteData {
  uv = [0, 0, 1, 0, 0, 1, 1, 1];
  color = "white";

  setContentSize(width: number, height: number): void {
    this.node.width = width;
    this.node.height = height;
    this.setVertsDirty();
  }

  setColor(color: string): void {
    this.color = color;
    this._assembler.updateColor(this, color);
  }
}

Assembler.register(CCSprite, SimpleSpriteAssembler);
