#include "cocos/audio/include/AudioEngine.h"

#include <iostream>

int main() {
  using cocos2d::experimental::AudioEngine;
  using cocos2d::experimental::AudioProfile;

  AudioProfile effects;
  effects.name = "effects";
  effects.maxInstances = 2;

  const int musicId = AudioEngine::play2d("audio/music.wav", true, 0.35f);
  const int first = AudioEngine::play2d("audio/hit.wav", false, 0.8f, &effects);
  const int second = AudioEngine::play2d("audio/hit.wav", false, 0.8f, &effects);
  const int rejected = AudioEngine::play2d("audio/hit.wav", false, 0.8f, &effects);
  std::cout << "同组第3路音效=" << rejected << "（-1 表示达到上限）\n";

  AudioEngine::setVolume(first, 0.4f);
  AudioEngine::setLoop(musicId, false);
  AudioEngine::stop(first);
  AudioEngine::uncache("audio/hit.wav");
  AudioEngine::stop(musicId);
  AudioEngine::uncacheAll();
  std::cout << "第二路 ID=" << second << ", active=" << AudioEngine::activeCount() << "\n";
  return 0;
}
