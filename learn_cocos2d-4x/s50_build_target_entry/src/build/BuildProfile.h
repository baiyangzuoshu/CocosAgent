#pragma once

#include <stdexcept>
#include <string>

namespace lesson {

struct BuildProfile {
    std::string target;
    std::string mode;
    std::string projectEntry;
    std::string outputKind;
};

inline BuildProfile selectBuildProfile(const std::string& target, const std::string& mode) {
    if (mode != "Debug" && mode != "Release") {
        throw std::invalid_argument("mode must be Debug or Release");
    }
    if (target == "macos") {
        return {"macOS", mode, "proj.ios_mac/mac/main.cpp", "executable: HelloCpp"};
    }
    if (target == "ios") {
        return {"iOS", mode, "proj.ios_mac/ios/main.m", "executable: HelloCpp"};
    }
    if (target == "android") {
        return {"Android", mode, "proj.android/app/jni/hellocpp/main.cpp", "shared library: MyGame"};
    }
    if (target == "linux") {
        return {"Linux", mode, "proj.linux/main.cpp", "executable: HelloCpp"};
    }
    if (target == "windows") {
        return {"Windows", mode, "proj.win32/main.cpp", "executable: HelloCpp"};
    }
    throw std::invalid_argument("supported lesson targets: macos, ios, android, linux, windows");
}

} // namespace lesson
