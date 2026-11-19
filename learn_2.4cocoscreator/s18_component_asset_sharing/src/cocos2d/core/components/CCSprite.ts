import type Node from "../CCNode.ts";
import type SpriteFrame from "../assets/CCSpriteFrame.ts";

/**
 * 本课只保留 Sprite 对 SpriteFrame 的引用关系，不创建渲染数据或调用 GPU。
 */
export default class Sprite {
  spriteFrame: SpriteFrame | null = null;

  constructor(readonly node: Node) {}

  setSpriteFrame(spriteFrame: SpriteFrame): void {
    this.spriteFrame = spriteFrame;
  }
}
