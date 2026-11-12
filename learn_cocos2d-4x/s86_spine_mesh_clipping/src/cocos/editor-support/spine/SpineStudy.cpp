#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const int sourceTriangles = 2;
  const int clippedTriangles = 3;
  lines.push_back("MeshAttachment provides world vertices and deform data.");
  lines.push_back("SkeletonClipping: " + std::to_string(sourceTriangles) + " input -> " + std::to_string(clippedTriangles) + " output triangles.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
