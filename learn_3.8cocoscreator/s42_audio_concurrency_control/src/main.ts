import { AudioClip } from "./cocos/audio/audio-clip.ts";
import { AudioSource } from "./cocos/audio/audio-source.ts";
import { audioManager } from "./cocos/audio/audio-manager.ts";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing demo element: ${id}`);
  return found as T;
}

const musicSource = new AudioSource();
musicSource.clip = new AudioClip({ url: "./assets/music.wav" });
musicSource.loop = true;
musicSource.volume = 0.4;

const effectSource = new AudioSource();
effectSource.clip = new AudioClip({ url: "./assets/effect.wav" });
effectSource.volume = 0.8;

const output = element<HTMLElement>("output");
const controls = [
  element<HTMLButtonElement>("start-music"),
  element<HTMLButtonElement>("play-effects"),
  element<HTMLInputElement>("music-volume"),
  element<HTMLInputElement>("effects-volume"),
  element<HTMLButtonElement>("stop-music"),
];

Promise.all([musicSource.ready, effectSource.ready]).then(() => {
  controls.forEach((control) => control.disabled = false);
  output.textContent = `AudioSource 已就绪；本课用 3 个通道演示并发上限。`;
}).catch((error: unknown) => {
  output.textContent = "音频加载失败：" + String(error);
});

element<HTMLButtonElement>("start-music").addEventListener("click", () => {
  void musicSource.play().then(() => {
    output.textContent = `循环音乐播放中；活动实例=${audioManager.activeCount}`;
  });
});

element<HTMLButtonElement>("play-effects").addEventListener("click", () => {
  for (let index = 0; index < 4; index += 1) {
    effectSource.playOneShot(new AudioClip({ url: "./assets/effect.wav" }), 0.7);
  }
  output.textContent = "循环音占一通道；提交第 3、4 路音效时会淘汰较早 one-shot。";
});

element<HTMLInputElement>("music-volume").addEventListener("input", (event) => {
  musicSource.volume = Number((event.currentTarget as HTMLInputElement).value);
  output.textContent = `背景 AudioSource.volume=${musicSource.volume.toFixed(1)}`;
});

element<HTMLInputElement>("effects-volume").addEventListener("input", (event) => {
  effectSource.volume = Number((event.currentTarget as HTMLInputElement).value);
  output.textContent = `后续 one-shot 基础音量=${effectSource.volume.toFixed(1)}；本次倍率=0.7`;
});

element<HTMLButtonElement>("stop-music").addEventListener("click", () => {
  void musicSource.stop().then(() => {
    output.textContent = `背景音停止并退出活动列表；活动实例=${audioManager.activeCount}`;
  });
});
