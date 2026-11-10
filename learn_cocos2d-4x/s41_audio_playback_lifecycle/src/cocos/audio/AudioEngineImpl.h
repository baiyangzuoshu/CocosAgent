#pragma once

#include <functional>
#include <string>
#include <unordered_map>

namespace cocos2d {
namespace experimental {

class AudioEngineImpl {
public:
  int play2d(const std::string& filePath, bool loop, float volume);
  void pause(int audioId);
  void resume(int audioId);
  void stop(int audioId);
  void setFinishCallback(
      int audioId,
      std::function<void(int, const std::string&)> callback);
  void signalFinished(int audioId, const std::string& filePath);

private:
  std::unordered_map<int, std::function<void(int, const std::string&)>>
      finishCallbacks_;
};

}
}
