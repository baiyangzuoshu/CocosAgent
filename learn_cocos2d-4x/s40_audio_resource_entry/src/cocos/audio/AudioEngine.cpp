#include "cocos/audio/include/AudioEngine.h"
#include "cocos/audio/AudioEngineImpl.h"

namespace cocos2d {
namespace experimental {

static AudioEngineImpl s_audioEngineImpl;

int AudioEngine::play2d(const std::string& filePath, bool loop, float volume) {
  if (filePath.empty()) return -1;
  return s_audioEngineImpl.play2d(filePath, loop, volume);
}

}
}
