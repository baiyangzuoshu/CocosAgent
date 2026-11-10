#pragma once

#include <string>

namespace cocos2d {
namespace experimental {

class AudioEngine {
public:
  static int play2d(const std::string& filePath, bool loop = false,
                    float volume = 1.0f);
};

}
}
