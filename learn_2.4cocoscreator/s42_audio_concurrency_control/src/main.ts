import { audioEngine } from "./cocos2d/audio/CCAudioEngine.ts";
import { CCAudioClip } from "./cocos2d/core/assets/CCAudioClip.ts";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing demo element: ${id}`);
  return found as T;
}

const musicClip = new CCAudioClip("./assets/music.wav");
const effectClip = new CCAudioClip("./assets/effect.wav");
const output = element<HTMLElement>("output");

element<HTMLButtonElement>("start-music").addEventListener("click", () => {
  const audioId = audioEngine.playMusic(musicClip, true);
  output.textContent = `循环背景音已启动，audioID=${audioId}`;
});

element<HTMLButtonElement>("play-effects").addEventListener("click", () => {
  const first = audioEngine.playEffect(effectClip);
  const second = audioEngine.playEffect(effectClip);
  output.textContent = `同一音效并发两次：audioID=${first}, ${second}`;
});

element<HTMLInputElement>("music-volume").addEventListener("input", (event) => {
  const volume = Number((event.currentTarget as HTMLInputElement).value);
  output.textContent = `背景音音量=${audioEngine.setMusicVolume(volume).toFixed(1)}`;
});

element<HTMLInputElement>("effects-volume").addEventListener("input", (event) => {
  const volume = Number((event.currentTarget as HTMLInputElement).value);
  output.textContent = `音效组音量=${audioEngine.setEffectsVolume(volume).toFixed(1)}`;
});

element<HTMLButtonElement>("stop-effects").addEventListener("click", () => {
  audioEngine.stopAllEffects();
  output.textContent = "停止全部音效；循环背景音仍保留。";
});

element<HTMLButtonElement>("unload-effects").addEventListener("click", () => {
  audioEngine.uncache(effectClip);
  output.textContent = "uncache(effectClip)：对应活动音效已停止并移除。";
});

element<HTMLButtonElement>("stop-music").addEventListener("click", () => {
  audioEngine.stopMusic();
  audioEngine.uncache(musicClip);
  output.textContent = "背景音已停止并从活动实例表移除。";
});
