#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const bool ownsSkeletonData = false;
  const bool ownsAtlas = false;
  lines.push_back("SkeletonRenderer can wrap a Skeleton or construct one from SkeletonData.");
  lines.push_back(std::string("_ownsSkeletonData=") + (ownsSkeletonData ? "true" : "false"));
  lines.push_back(std::string("_ownsAtlas=") + (ownsAtlas ? "true" : "false"));
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
