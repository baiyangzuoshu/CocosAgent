#include "build/BuildProfile.h"

#include <iostream>

int main(int argc, char** argv) {
    try {
        const std::string target = argc > 1 ? argv[1] : "macos";
        const std::string mode = argc > 2 ? argv[2] : "Debug";
        const lesson::BuildProfile profile = lesson::selectBuildProfile(target, mode);
        std::cout << "Cocos2d-x 3 CMake profile\n"
                  << "target=" << profile.target << " mode=" << profile.mode << "\n"
                  << "entry=" << profile.projectEntry << "\n"
                  << "output=" << profile.outputKind << std::endl;
    } catch (const std::exception& error) {
        std::cerr << error.what() << std::endl;
        return 1;
    }
}
