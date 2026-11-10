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

void SimpleAudioEngine::playBackgroundMusic(const char* filePath, bool loop) {
  if (!filePath) return;
  if (!_backgroundMusic) _backgroundMusic.reset(new MciPlayer());
  _backgroundMusic->Open(filePath, 0);
  _backgroundMusic->Play(loop);
}

void SimpleAudioEngine::stopBackgroundMusic(bool releaseData) {
  if (!_backgroundMusic) return;
  _backgroundMusic->Stop();
  if (releaseData) _backgroundMusic.reset();
}

void SimpleAudioEngine::setBackgroundMusicVolume(float) {
  std::cout << "setBackgroundMusicVolume: no-op in this Win32 source\n";
}

void SimpleAudioEngine::setEffectsVolume(float) {
  std::cout << "setEffectsVolume: no-op in this Win32 source\n";
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

void SimpleAudioEngine::stopAllEffects() {
  for (auto& effect : _effects) effect.second->Stop();
}

void SimpleAudioEngine::unloadEffect(const char* filePath) {
  if (!filePath) return;
  const unsigned int soundId =
      static_cast<unsigned int>(std::hash<std::string>{}(filePath));
  const auto found = _effects.find(soundId);
  if (found == _effects.end()) return;
  found->second->Stop();
  _effects.erase(found);
  std::cout << "unloadEffect id=" << soundId << "\n";
}

}
