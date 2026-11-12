#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const std::string version = "SkeletonData._version";
  lines.push_back("SkeletonJson / SkeletonBinary record: " + version);
  lines.push_back("Select matching exporter and v3 or v4 Runtime; stored version is not a compatibility verdict.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
