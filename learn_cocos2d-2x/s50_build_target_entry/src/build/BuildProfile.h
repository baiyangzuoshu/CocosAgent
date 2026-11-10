#pragma once

#include <stdexcept>
#include <string>

namespace lesson {

struct BuildProfile {
    std::string target;
    std::string projectEntry;
    std::string buildSystem;
    std::string configurationSource;
};

inline BuildProfile selectBuildProfile(const std::string& target) {
    if (target == "linux") {
        return {"linux", "template/multi-platform-cpp/proj.linux/Makefile", "GNU Make", "cocos2dx.mk"};
    }
    if (target == "win32") {
        return {"win32", "template/multi-platform-cpp/proj.win32/HelloCpp.vcxproj", "Visual Studio", "project configuration"};
    }
    throw std::invalid_argument("supported lesson targets: linux, win32");
}

} // namespace lesson
