#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> slots = {"body", "arm", "head"};
  lines.push_back("Skin selects RegionAttachment; drawOrder controls Slot traversal.");
  for (const auto& slot : slots) lines.push_back("  Slot: " + slot);
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
