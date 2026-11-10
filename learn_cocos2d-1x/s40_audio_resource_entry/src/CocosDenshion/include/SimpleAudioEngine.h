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
  unsigned int playEffect(const char* filePath, bool loop = false);

private:
  void preloadEffect(const char* filePath);
  std::unordered_map<unsigned int, std::unique_ptr<MciPlayer>> _effects;
};

}
