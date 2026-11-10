#pragma once

#include <stdexcept>
#include <string>

namespace lesson {

struct BuildProfile {
    std::string target;
    std::string projectEntry;
    std::string platformDefine;
    std::string compilerFlags;
    std::string libraryPath;
};

inline BuildProfile selectBuildProfile(const std::string& target) {
    if (target == "linux") {
        return {"linux", "HelloWorld/linux/Makefile", "-DLINUX", "-Wall -g -O2", "lib/linux/Debug"};
    }
    if (target == "win32") {
        return {"win32", "HelloWorld/win32/HelloWorld.win32.vcxproj", "project configuration", "MSVC project settings", "project configuration"};
    }
    throw std::invalid_argument("supported lesson targets: linux, win32");
}

} // namespace lesson
