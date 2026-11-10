export class Texture2D {
  constructor(public readonly url: string) {}
}

export class SpriteFrame {
  constructor(public readonly texture: Texture2D) {}
}
