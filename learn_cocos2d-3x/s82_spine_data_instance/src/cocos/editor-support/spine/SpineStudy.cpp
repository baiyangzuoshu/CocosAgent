#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const bool ownsSkeletonData = false;
  lines.push_back("SkeletonRenderer::initWithData creates a Skeleton around shared spSkeletonData.");
  lines.push_back(std::string("_ownsSkeletonData=") + (ownsSkeletonData ? "true" : "false"));
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
