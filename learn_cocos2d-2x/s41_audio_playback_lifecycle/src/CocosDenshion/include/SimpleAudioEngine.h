#pragma once

#include <memory>
#include <string>
#include <unordered_map>

#include "../emscripten/Mixer.h"

namespace CocosDenshion {

class SimpleAudioEngine {
public:
  static SimpleAudioEngine* sharedEngine();
  unsigned int playEffect(const char* filePath, bool loop = false);
  void pauseEffect(unsigned int soundId);
  void resumeEffect(unsigned int soundId);
  void stopEffect(unsigned int soundId);

private:
  std::unordered_map<std::string, std::unique_ptr<SDL::MixChunk>> _effects;
};

}
