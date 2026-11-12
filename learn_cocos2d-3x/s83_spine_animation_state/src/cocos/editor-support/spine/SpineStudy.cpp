#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> track0 = {"idle", "attack"};
  std::vector<std::string> track1 = {"upper-body"};
  lines.push_back("spAnimationState_setAnimation replaces a track; addAnimation queues.");
  lines.push_back("track 0: " + track0[0] + " -> " + track0[1]);
  lines.push_back("track 1: " + track1[0]);
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
