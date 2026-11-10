#pragma once

#include <string>
#include <unordered_set>

namespace cocos2d {
namespace experimental {

class AudioEngineImpl {
public:
  int play2d(const std::string& path, bool loop, float volume);
  void setLoop(int audioId, bool loop);
  void setVolume(int audioId, float volume);
  void stop(int audioId);
  void stopAll();
  void uncache(const std::string& path);
  void uncacheAll();

private:
  int nextAudioId_ = 1;
  std::unordered_set<std::string> cachedPaths_;
};

}
}
