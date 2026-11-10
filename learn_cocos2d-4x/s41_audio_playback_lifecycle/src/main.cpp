#include "cocos/audio/include/AudioEngine.h"

#include <iostream>

int main() {
  using cocos2d::experimental::AudioEngine;
  const int id = AudioEngine::play2d("audio/click.wav");
  AudioEngine::setFinishCallback(id, [](int finishedId, const std::string&) {
    std::cout << "播放完成回调 id=" << finishedId << "\n";
  });
  AudioEngine::pause(id);
  AudioEngine::resume(id);
  AudioEngine::notifyFinishedForDemo(id);
  std::cout << "完成后 getState="
            << (AudioEngine::getState(id) == AudioEngine::AudioState::ERROR
                    ? "ERROR"
                    : "ACTIVE")
            << "\n";

  const int stoppedId = AudioEngine::play2d("audio/stop.wav");
  AudioEngine::setFinishCallback(stoppedId, [](int, const std::string&) {
    std::cout << "停止的音频不走自然完成回调\n";
  });
  AudioEngine::stop(stoppedId);
  std::cout << "停止后 getState="
            << (AudioEngine::getState(stoppedId) == AudioEngine::AudioState::ERROR
                    ? "ERROR"
                    : "ACTIVE")
            << "\n";
  return 0;
}
