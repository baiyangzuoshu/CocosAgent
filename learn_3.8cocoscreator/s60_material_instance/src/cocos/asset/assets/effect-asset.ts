export interface PassInfo {
  name: string;
  blendState: { enabled: boolean; src: string; dst: string };
}

export interface TechniqueInfo {
  name: string;
  passes: PassInfo[];
}

export class EffectAsset {
  constructor(
    readonly name: string,
    readonly techniques: TechniqueInfo[],
  ) {}
}
