import { CCAsset } from "./CCAsset.ts";

/** Memory-only Asset record used to show that Texture2D identity is shared. */
export default class Texture2D extends CCAsset {
  constructor(readonly url: string, readonly width: number, readonly height: number) {
    super("hero-texture", {
      name: "HeroAtlas",
      textureUrl: url,
      atlasSize: { width, height },
      rect: { x: 0, y: 0, width, height },
    });
  }
}
