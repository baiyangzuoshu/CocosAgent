import { AudioClip } from "./cocos/audio/audio-clip.ts";
import {
  AudioSource,
  AudioSourceEventType,
} from "./cocos/audio/audio-source.ts";

const playButton = document.querySelector<HTMLButtonElement>("#play");
const pauseButton = document.querySelector<HTMLButtonElement>("#pause");
const resumeButton = document.querySelector<HTMLButtonElement>("#resume");
const stopButton = document.querySelector<HTMLButtonElement>("#stop");
const output = document.querySelector<HTMLElement>("#output");

if (!playButton || !pauseButton || !resumeButton || !stopButton || !output) {
  throw new Error("Audio demo elements are missing");
}

const source = new AudioSource();
source.clip = new AudioClip({ url: "./assets/tone.wav" });

source.node.on(AudioSourceEventType.ENDED, () => {
  output.textContent = "AudioSource 收到 ENDED；PAL Player 状态回到 INIT。";
});

void source.ready.then(
  () => {
    playButton.textContent = "播放";
    playButton.disabled = false;
    pauseButton.disabled = false;
    resumeButton.disabled = false;
    stopButton.disabled = false;
    output.textContent = "AudioSource → PAL AudioPlayer；浏览器 HTMLAudioElement 已就绪。";
  },
  (error: unknown) => {
    output.textContent = "加载失败：" + String(error);
  },
);

playButton.addEventListener("click", () => {
  void source.play().then(() => {
    output.textContent = "play()，状态=" + source.state;
  }).catch((error: unknown) => {
    output.textContent = "播放失败：" + String(error);
  });
});

pauseButton.addEventListener("click", () => {
  void source.pause().then(() => {
    output.textContent = "pause()，状态=" + source.state;
  });
});

resumeButton.addEventListener("click", () => {
  void source.play().then(() => {
    output.textContent = "AudioSource 没有单独 resume()；play() 在暂停状态继续播放。状态=" +
      source.state;
  }).catch((error: unknown) => {
    output.textContent = "恢复失败：" + String(error);
  });
});

stopButton.addEventListener("click", () => {
  void source.stop().then(() => {
    output.textContent = "stop()，状态=" + source.state;
  });
});
