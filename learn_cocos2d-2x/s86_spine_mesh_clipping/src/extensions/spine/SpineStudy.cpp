#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  const int quadCorners = 4;
  lines.push_back("RegionAttachment updates a quad with " + std::to_string(quadCorners) + " corners.");
  lines.push_back("This snapshot has no MeshAttachment or ClippingAttachment.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
