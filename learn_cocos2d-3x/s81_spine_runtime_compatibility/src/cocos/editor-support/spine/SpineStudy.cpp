#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const std::string version = "spSkeletonData.version";
  lines.push_back("SkeletonJson / SkeletonBinary record: " + version);
  lines.push_back("The parser stores the field; verify the pinned C Runtime against the exporter.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
