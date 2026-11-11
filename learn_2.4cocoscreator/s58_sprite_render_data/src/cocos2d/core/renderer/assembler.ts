export interface SpriteNode {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  renderFlag: number;
}

export interface SpriteData {
  _assembler: SpriteAssembler;
  node: SpriteNode;
  uv: number[];
  color: string;
  _vertsDirty: boolean;
  renderData: import("./render-data.ts").RenderData;
}

export interface SpriteAssembler {
  updateRenderData(sprite: SpriteData): void;
  updateColor(sprite: SpriteData, color: string): void;
  fillBuffers(sprite: SpriteData): void;
}

export class Assembler {
  static register(componentClass: Function, assemblerClass: new () => SpriteAssembler): void {
    const registeredClass = componentClass as unknown as {
      __assembler__?: new () => SpriteAssembler;
    };
    registeredClass.__assembler__ = assemblerClass;
  }

  static init(component: { constructor: unknown }): SpriteAssembler {
    const componentClass = component.constructor as {
      __assembler__?: new () => SpriteAssembler;
    };
    const AssemblerClass = componentClass.__assembler__;
    if (!AssemblerClass) throw new Error("No assembler registered for render component");
    const assembler = new AssemblerClass();
    console.log("Assembler.init -> registered component assembler");
    return assembler;
  }
}
