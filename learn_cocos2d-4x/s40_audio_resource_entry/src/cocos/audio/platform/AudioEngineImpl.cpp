#include "cocos/audio/AudioEngineImpl.h"

#include <iostream>

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

}
}
