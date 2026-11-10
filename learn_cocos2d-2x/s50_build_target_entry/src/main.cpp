#include "build/BuildProfile.h"

#include <iostream>

int main(int argc, char** argv) {
    try {
        const std::string target = argc > 1 ? argv[1] : "linux";
        const lesson::BuildProfile profile = lesson::selectBuildProfile(target);
        std::cout << "target=" << profile.target << "\n"
                  << "entry=" << profile.projectEntry << "\n"
                  << "buildSystem=" << profile.buildSystem << "\n"
                  << "configuration=" << profile.configurationSource << std::endl;
    } catch (const std::exception& error) {
        std::cerr << error.what() << std::endl;
        return 1;
    }
}
