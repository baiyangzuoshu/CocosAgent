#include "CocosDenshion/include/SimpleAudioEngine.h"

#include <iostream>

namespace CocosDenshion {

SimpleAudioEngine* SimpleAudioEngine::sharedEngine() {
  static SimpleAudioEngine engine;
  return &engine;
}

unsigned int SimpleAudioEngine::playEffect(const char* filePath, bool loop) {
  if (!filePath) return 0;
  const std::string key(filePath);
  auto found = _effects.find(key);
  if (found == _effects.end()) {
    found = _effects.emplace(
        key, std::unique_ptr<SDL::MixChunk>(SDL::Mix_LoadWAV(filePath))).first;
  }

  const unsigned int id =
      static_cast<unsigned int>(std::hash<std::string>{}(key));
  std::cout << "SimpleAudioEngine::playEffect id=" << id << "\n";
  SDL::Mix_PlayChannel(static_cast<int>(id % 32), found->second.get(),
                       loop ? -1 : 0);
  return id;
}

}
