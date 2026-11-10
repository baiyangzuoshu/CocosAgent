#include "cocos/audio/AudioEngineImpl.h"

#include <iostream>
#include <utility>

namespace cocos2d {
namespace experimental {

int AudioEngineImpl::play2d(const std::string& filePath, bool loop,
                             float volume) {
  static int nextAudioId = 1;
  std::cout << "AudioEngineImpl::play2d path=" << filePath
            << " loop=" << (loop ? "true" : "false")
            << " volume=" << volume << "\n";
  return nextAudioId++;
}

void AudioEngineImpl::pause(int audioId) {
  std::cout << "AudioEngineImpl::pause id=" << audioId << "\n";
}

void AudioEngineImpl::resume(int audioId) {
  std::cout << "AudioEngineImpl::resume id=" << audioId << "\n";
}

void AudioEngineImpl::stop(int audioId) {
  std::cout << "AudioEngineImpl::stop id=" << audioId << "\n";
  finishCallbacks_.erase(audioId);
}

void AudioEngineImpl::setFinishCallback(
    int audioId, std::function<void(int, const std::string&)> callback) {
  finishCallbacks_[audioId] = std::move(callback);
}

void AudioEngineImpl::signalFinished(int audioId,
                                     const std::string& filePath) {
  const auto found = finishCallbacks_.find(audioId);
  if (found == finishCallbacks_.end()) return;
  std::cout << "AudioEngineImpl::finished id=" << audioId << "\n";
  found->second(audioId, filePath);
  finishCallbacks_.erase(found);
}

}
}
