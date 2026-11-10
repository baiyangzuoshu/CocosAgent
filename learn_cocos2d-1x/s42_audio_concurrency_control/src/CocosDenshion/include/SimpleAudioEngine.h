#pragma once

#include <memory>
#include <string>
#include <unordered_map>

namespace CocosDenshion {

class MciPlayer;

class SimpleAudioEngine {
public:
  SimpleAudioEngine();
  ~SimpleAudioEngine();
  static SimpleAudioEngine* sharedEngine();

  void playBackgroundMusic(const char* filePath, bool loop = false);
  void stopBackgroundMusic(bool releaseData = false);
  void setBackgroundMusicVolume(float volume);
  void setEffectsVolume(float volume);
  unsigned int playEffect(const char* filePath, bool loop = false);
  void stopAllEffects();
  void unloadEffect(const char* filePath);

private:
  void preloadEffect(const char* filePath);
  std::unique_ptr<MciPlayer> _backgroundMusic;
  std::unordered_map<unsigned int, std::unique_ptr<MciPlayer>> _effects;
};

}
