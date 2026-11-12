#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> route = {"SkeletonRenderer", "TrianglesCommand", "SkeletonBatch", "OpenGL Renderer"};
  std::string joined;
  for (const auto& part : route) joined += (joined.empty() ? "" : " -> ") + part;
  lines.push_back(joined);
  lines.push_back("Texture, blend state, or capacity boundaries can split commands.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
