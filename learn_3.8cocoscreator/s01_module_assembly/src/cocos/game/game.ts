import { cclegacy } from "../core/global-exports.ts";

export class Game {
  readonly name = "Game";
}

export const game = (cclegacy.game = new Game());
