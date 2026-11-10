import { CCAudio } from "./CCAudio.ts";
import { CCAudioClip } from "../core/assets/CCAudioClip.ts";

export class CCAudioEngine {
  play(clip: CCAudioClip, loop = false, volume = 1): Promise<void> {
    console.info("cc.audioEngine.play:", clip.nativeUrl);
    const audio = new CCAudio(clip);
    return audio.play(loop, volume);
  }
}

export const audioEngine = new CCAudioEngine();
