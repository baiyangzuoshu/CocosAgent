import { AudioClip } from "./cocos/audio/audio-clip.ts";
import { AudioSource } from "./cocos/audio/audio-source.ts";

const button = document.querySelector<HTMLButtonElement>("#play");
const output = document.querySelector<HTMLElement>("#output");

if (!button || !output) {
  throw new Error("Audio demo elements are missing");
}

const source = new AudioSource();
source.clip = new AudioClip({ url: "./assets/tone.wav" });

void source.ready.then(
  () => {
    button.disabled = false;
    button.textContent = "播放 AudioClip";
    output.textContent = "AudioClip → AudioSource → PAL AudioPlayer → HTMLAudioElement";
  },
  (error: unknown) => {
    output.textContent = "加载失败：" + String(error);
  },
);

button.addEventListener("click", () => {
  void source.play().catch((error: unknown) => {
    output.textContent = "播放失败：" + String(error);
  });
});
