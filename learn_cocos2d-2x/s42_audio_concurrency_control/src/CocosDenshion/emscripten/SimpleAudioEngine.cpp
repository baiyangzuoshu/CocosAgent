#include "CocosDenshion/include/SimpleAudioEngine.h"

#include <algorithm>
#include <functional>
#include <iostream>

namespace CocosDenshion {

SimpleAudioEngine* SimpleAudioEngine::sharedEngine() {
  static SimpleAudioEngine engine;
  return &engine;
}

void SimpleAudioEngine::playBackgroundMusic(const char* filePath, bool loop) {
  if (!filePath) return;
  const std::string key(filePath);
  auto found = _music.find(key);
  if (found == _music.end()) {
    found = _music.emplace(
        key, std::unique_ptr<SDL::MixMusic>(SDL::Mix_LoadMUS(filePath))).first;
  }
  SDL::Mix_PlayMusic(found->second.get(), loop ? -1 : 0);
}

void SimpleAudioEngine::stopBackgroundMusic(bool) {
  SDL::Mix_HaltMusic();
}

void SimpleAudioEngine::setBackgroundMusicVolume(float volume) {
  volume = std::max(0.0f, std::min(1.0f, volume));
  SDL::Mix_VolumeMusic(static_cast<int>(volume * 128));
}

void SimpleAudioEngine::setEffectsVolume(float volume) {
  volume = std::max(0.0f, std::min(1.0f, volume));
  const int mixerVolume = static_cast<int>(volume * 128);
  for (int channel = 0; channel < ChannelCount; ++channel) {
    SDL::Mix_Volume(channel, mixerVolume);
  }
}

unsigned int SimpleAudioEngine::playEffect(const char* filePath, bool loop) {
  if (!filePath) return 0;
  const std::string key(filePath);
  auto found = _effects.find(key);
  if (found == _effects.end()) {
    found = _effects.emplace(
        key, std::unique_ptr<SDL::MixChunk>(SDL::Mix_LoadWAV(filePath))).first;
  }

  const unsigned int soundId =
      static_cast<unsigned int>(std::hash<std::string>{}(key));
  const int channel = static_cast<int>(soundId % ChannelCount);
  SDL::Mix_PlayChannel(channel, found->second.get(), loop ? -1 : 0);
  return soundId;
}

void SimpleAudioEngine::stopAllEffects() {
  for (int channel = 0; channel < ChannelCount; ++channel) {
    SDL::Mix_HaltChannel(channel);
  }
}

void SimpleAudioEngine::unloadEffect(const char* filePath) {
  if (!filePath) return;
  const auto found = _effects.find(filePath);
  if (found == _effects.end()) return;
  _effects.erase(found);
  std::cout << "unloadEffect " << filePath << "\n";
}

}
