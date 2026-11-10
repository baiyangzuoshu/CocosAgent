export interface AudioMeta {
  url: string;
}

export class AudioClip {
  constructor(readonly _nativeAsset: AudioMeta) {}
}
