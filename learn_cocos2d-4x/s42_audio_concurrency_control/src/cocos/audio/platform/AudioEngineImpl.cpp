#include "cocos/audio/AudioEngineImpl.h"

#include <iostream>

namespace cocos2d {
namespace experimental {

int AudioEngineImpl::play2d(const std::string& path, bool loop, float volume) {
  if (cachedPaths_.insert(path).second) {
    std::cout << "AudioEngineImpl::load " << path << "\n";
  }
  const int audioId = nextAudioId_++;
  std::cout << "AudioEngineImpl::play2d id=" << audioId << " path=" << path
            << " loop=" << loop << " volume=" << volume << "\n";
  return audioId;
}

void AudioEngineImpl::setLoop(int audioId, bool loop) {
  std::cout << "AudioEngineImpl::setLoop id=" << audioId << " loop=" << loop << "\n";
}

void AudioEngineImpl::setVolume(int audioId, float volume) {
  std::cout << "AudioEngineImpl::setVolume id=" << audioId
            << " volume=" << volume << "\n";
}

void AudioEngineImpl::stop(int audioId) {
  std::cout << "AudioEngineImpl::stop id=" << audioId << "\n";
}

void AudioEngineImpl::stopAll() {
  std::cout << "AudioEngineImpl::stopAll\n";
}

void AudioEngineImpl::uncache(const std::string& path) {
  cachedPaths_.erase(path);
  std::cout << "AudioEngineImpl::uncache " << path << "\n";
}

void AudioEngineImpl::uncacheAll() {
  cachedPaths_.clear();
  std::cout << "AudioEngineImpl::uncacheAll\n";
}

}
}
