#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const bool ownsSkeletonData = false;
  lines.push_back("CCSkeleton creates one Skeleton from shared SkeletonData.");
  lines.push_back(std::string("ownsSkeletonData=") + (ownsSkeletonData ? "true" : "false"));
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
