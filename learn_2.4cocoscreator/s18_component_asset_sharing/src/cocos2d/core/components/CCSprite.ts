import Component from "./CCComponent.ts";
import type SpriteFrame from "../assets/CCSpriteFrame.ts";

/**
 * 本课只保留 Sprite 对 SpriteFrame 的引用关系，不创建渲染数据或调用 GPU。
 */
export default class Sprite extends Component {
  spriteFrame: SpriteFrame | null = null;

  setSpriteFrame(spriteFrame: SpriteFrame): void {
    this.spriteFrame = spriteFrame;
  }
}
