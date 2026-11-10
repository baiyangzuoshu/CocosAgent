#pragma once

#include <string>

namespace cocos2d {
namespace experimental {

class AudioEngineImpl {
public:
  int play2d(const std::string& filePath, bool loop, float volume);
};

}
}
