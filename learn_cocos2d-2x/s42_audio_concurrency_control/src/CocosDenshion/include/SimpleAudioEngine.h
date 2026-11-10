#pragma once

#include <memory>
#include <string>
#include <unordered_map>

#include "../emscripten/Mixer.h"

namespace CocosDenshion {

class SimpleAudioEngine {
public:
  static SimpleAudioEngine* sharedEngine();
  void playBackgroundMusic(const char* filePath, bool loop = false);
  void stopBackgroundMusic(bool releaseData = false);
  void setBackgroundMusicVolume(float volume);
  void setEffectsVolume(float volume);
  unsigned int playEffect(const char* filePath, bool loop = false);
  void stopAllEffects();
  void unloadEffect(const char* filePath);

private:
  static constexpr int ChannelCount = 32;
  std::unordered_map<std::string, std::unique_ptr<SDL::MixMusic>> _music;
  std::unordered_map<std::string, std::unique_ptr<SDL::MixChunk>> _effects;
};

}
