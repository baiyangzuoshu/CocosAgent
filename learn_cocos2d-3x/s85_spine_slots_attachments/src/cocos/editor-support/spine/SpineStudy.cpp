#include "SpineStudy.h"
#include <iostream>
#include <string>
#include <vector>

namespace cocos2d {
namespace spine_study {
void run() {
  std::vector<std::string> lines;
  std::vector<std::string> slots = {"body-slot", "weapon-slot", "head-slot"};
  lines.push_back("Skin changes attachments; Skeleton drawOrder controls traversal.");
  for (const auto& slot : slots) lines.push_back("  " + slot);
  for (const auto& line : lines) std::cout << line << std::endl;
}
}
}
