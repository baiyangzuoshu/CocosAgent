#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> route = {"SkeletonRenderer", "TrianglesCommand", "v3/v4 SkeletonBatch", "Renderer backend"};
  std::string joined;
  for (const auto& part : route) joined += (joined.empty() ? "" : " -> ") + part;
  lines.push_back(joined);
  lines.push_back("Batch implementation depends on the selected Runtime tree.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
