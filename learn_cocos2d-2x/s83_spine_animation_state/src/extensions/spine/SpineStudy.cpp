#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> state0 = {"idle", "attack"};
  std::vector<std::string> state1 = {"blink"};
  lines.push_back("CCSkeletonAnimation selects AnimationState by stateIndex.");
  lines.push_back("state 0 queue: " + state0[0] + " -> " + state0[1]);
  lines.push_back("state 1: " + state1[0] + "; this is not later trackIndex layering.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
