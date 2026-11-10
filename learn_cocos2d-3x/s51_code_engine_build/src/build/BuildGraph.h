#pragma once

#include <string>
#include <vector>

namespace lesson {

struct CMakeTarget {
    std::string name;
    std::string outputKind;
    std::vector<std::string> links;
};

inline std::vector<CMakeTarget> templateTargets(bool android) {
    CMakeTarget app = {"HelloCpp", android ? "SHARED library" : "executable", {"cocos2d"}};
    if (android) app.links.push_back("cpp_android_spec");
    return {
        {"external", "CMake subdirectory", {}},
        {"cocos2d", "engine library", {"external"}},
        app,
    };
}

} // namespace lesson
