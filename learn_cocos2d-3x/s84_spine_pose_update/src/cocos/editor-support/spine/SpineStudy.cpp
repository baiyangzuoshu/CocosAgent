#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> steps = {"spAnimationState_update", "spAnimationState_apply", "spSkeleton_updateWorldTransform"};
  const float rootWorldX = 2.0f;
  const float armLocalX = 3.0f;
  lines.push_back("arm world x = " + std::to_string(rootWorldX + armLocalX));
  lines.push_back("SkeletonAnimation::update:");
  for (const auto& step : steps) lines.push_back("  " + step);
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
