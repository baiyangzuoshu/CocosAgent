#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const std::string version = "SkeletonData.version";
  lines.push_back("SkeletonJson records export metadata: " + version);
  lines.push_back("This snapshot reads JSON; do not infer Binary support or automatic version validation.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
