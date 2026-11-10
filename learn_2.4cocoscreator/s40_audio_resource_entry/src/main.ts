import { audioEngine } from "./cocos2d/audio/CCAudioEngine.ts";
import { CCAudioClip } from "./cocos2d/core/assets/CCAudioClip.ts";

const button = document.querySelector<HTMLButtonElement>("#play");
const output = document.querySelector<HTMLElement>("#output");

if (!button || !output) {
  throw new Error("Audio demo elements are missing");
}

const clip = new CCAudioClip("./assets/tone.wav");

button.addEventListener("click", () => {
  output.textContent = "AudioClip → cc.audioEngine.play → CCAudio → HTMLAudioElement";
  void audioEngine.play(clip).then(
    () => {
      output.textContent += "\n播放请求已交给浏览器";
    },
    (error: unknown) => {
      output.textContent += "\n播放失败：" + String(error);
    },
  );
});
