#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const bool debugBones = true;
  const bool ownsData = true;
  lines.push_back(std::string("debugBones=") + (debugBones ? "on" : "off"));
  lines.push_back("This snapshot has no timeline event callback API.");
  lines.push_back(std::string("destructor owns SkeletonData=") + (ownsData ? "true" : "false"));
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
