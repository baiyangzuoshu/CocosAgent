import { audioEngine } from "./cocos2d/audio/CCAudioEngine.ts";
import { CCAudioClip } from "./cocos2d/core/assets/CCAudioClip.ts";

const playButton = document.querySelector<HTMLButtonElement>("#play");
const pauseButton = document.querySelector<HTMLButtonElement>("#pause");
const resumeButton = document.querySelector<HTMLButtonElement>("#resume");
const stopButton = document.querySelector<HTMLButtonElement>("#stop");
const output = document.querySelector<HTMLElement>("#output");

if (!playButton || !pauseButton || !resumeButton || !stopButton || !output) {
  throw new Error("Audio demo elements are missing");
}

const outputElement = output;
const clip = new CCAudioClip("./assets/tone.wav");
let audioId: number | null = null;

function show(message: string): void {
  outputElement.textContent = message;
}

playButton.addEventListener("click", () => {
  if (audioId !== null) audioEngine.stop(audioId);
  audioId = audioEngine.play(clip, false, 0.7);
  audioEngine.setFinishCallback(audioId, () => {
    show("AudioEngine 收到播放完成回调；音频实例已回收。");
    audioId = null;
  });
  show("已播放，audioID=" + audioId + "，状态=" + audioEngine.getState(audioId));
});

pauseButton.addEventListener("click", () => {
  if (audioId === null) return show("当前没有活动音频实例。");
  audioEngine.pause(audioId);
  show("pause(" + audioId + ")，状态=" + audioEngine.getState(audioId));
});

resumeButton.addEventListener("click", () => {
  if (audioId === null) return show("当前没有活动音频实例。");
  const currentId = audioId;
  void audioEngine.resume(currentId).then(() => {
    show("resume(" + currentId + ")，状态=" + audioEngine.getState(currentId));
  });
});

stopButton.addEventListener("click", () => {
  if (audioId === null) return show("当前没有活动音频实例。");
  const stoppedId = audioId;
  audioEngine.stop(stoppedId);
  audioId = null;
  show("stop(" + stoppedId + ")，实例已从引擎移除。");
});
