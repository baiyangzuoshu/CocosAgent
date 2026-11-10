#pragma once

#include <functional>
#include <string>

namespace cocos2d {
namespace experimental {

class AudioEngine {
public:
  enum class AudioState {
    ERROR,
    INITIALIZING,
    PLAYING,
    PAUSED,
  };
  using FinishCallback = std::function<void(int, const std::string&)>;

  static int play2d(const std::string& filePath, bool loop = false,
                    float volume = 1.0f);
  static void pause(int audioId);
  static void resume(int audioId);
  static void stop(int audioId);
  static AudioState getState(int audioId);
  static void setFinishCallback(int audioId, FinishCallback callback);

  // Demo-only hook that stands in for the platform's natural-end notification.
  static void notifyFinishedForDemo(int audioId);
};

}
}
