#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> callbacks = {"start", "interrupt", "event", "complete", "end", "dispose"};
  lines.push_back("SkeletonAnimation dispatches AnimationState callbacks:");
  for (const auto& callback : callbacks) lines.push_back("  " + callback);
  lines.push_back("Renderer cleanup disposes Skeleton, Atlas, clipper and optional SkeletonData.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
