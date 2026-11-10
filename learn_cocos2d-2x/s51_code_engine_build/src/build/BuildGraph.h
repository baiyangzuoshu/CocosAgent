#pragma once

#include <string>
#include <vector>

namespace lesson {

struct BuildStep {
    std::string target;
    std::string output;
    std::vector<std::string> prerequisites;
};

inline std::vector<BuildStep> linuxBuildGraph() {
    return {
        {"engine objects", "cocos2dx/*.o", {"cocos2dx source files"}},
        {"cocos2d", "libcocos2d.so", {"engine objects"}},
        {"game objects", "HelloCpp/*.o", {"HelloCpp source files"}},
        {"HelloCpp", "HelloCpp", {"game objects", "libcocos2d.so"}},
    };
}

} // namespace lesson
