#include "CocosDenshion/include/SimpleAudioEngine.h"
#include "MciPlayer.h"

#include <functional>
#include <iostream>

namespace CocosDenshion {

SimpleAudioEngine::SimpleAudioEngine() = default;
SimpleAudioEngine::~SimpleAudioEngine() = default;

SimpleAudioEngine* SimpleAudioEngine::sharedEngine() {
  static SimpleAudioEngine engine;
  return &engine;
}

void SimpleAudioEngine::preloadEffect(const char* filePath) {
  if (!filePath) return;
  const unsigned int soundId =
      static_cast<unsigned int>(std::hash<std::string>{}(filePath));
  if (_effects.count(soundId)) return;

  auto player = std::unique_ptr<MciPlayer>(new MciPlayer());
  player->Open(filePath, soundId);
  _effects.emplace(soundId, std::move(player));
}

unsigned int SimpleAudioEngine::playEffect(const char* filePath, bool loop) {
  if (!filePath) return 0;
  const unsigned int soundId =
      static_cast<unsigned int>(std::hash<std::string>{}(filePath));
  preloadEffect(filePath);
  std::cout << "SimpleAudioEngine::playEffect id=" << soundId << "\n";
  _effects.at(soundId)->Play(loop);
  return soundId;
}

}
