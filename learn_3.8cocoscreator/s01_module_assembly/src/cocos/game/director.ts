import { cclegacy } from "../core/global-exports.ts";

export class Director {
  readonly name = "Director";
}

export const director = (cclegacy.director = new Director());
