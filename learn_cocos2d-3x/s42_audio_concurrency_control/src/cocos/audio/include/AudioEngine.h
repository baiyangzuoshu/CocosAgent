#pragma once

#include <string>

namespace cocos2d {
namespace experimental {

struct AudioProfile {
  std::string name;
  unsigned int maxInstances = 0;
  double minDelay = 0;
};

class AudioEngine {
public:
  static int play2d(const std::string& path, bool loop = false,
                    float volume = 1.0f, const AudioProfile* profile = nullptr);
  static void setLoop(int audioId, bool loop);
  static void setVolume(int audioId, float volume);
  static void stop(int audioId);
  static void stopAll();
  static void uncache(const std::string& path);
  static void uncacheAll();
  static int activeCount();
};

}
}
