#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> route = {"CCSkeleton::draw", "RegionAttachment_updateQuad", "TextureAtlas::drawQuads", "OpenGL"};
  std::string joined;
  for (const auto& part : route) joined += (joined.empty() ? "" : " -> ") + part;
  lines.push_back(joined);
  lines.push_back("Direct draw path; no Renderer command queue.");
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
