#include "build/BuildGraph.h"

#include <iostream>
#include <string>

int main(int argc, char** argv) {
    const std::string platform = argc > 1 ? argv[1] : "desktop";
    const bool android = platform == "android";
    if (!android && platform != "desktop") {
        std::cerr << "usage: build-graph [desktop|android]\n";
        return 1;
    }

    std::cout << "Cocos2d-x 4.x CMake target graph (" << platform << ")\n";
    for (const lesson::CMakeTarget& target : lesson::templateTargets(android)) {
        std::cout << target.name << " [" << target.outputKind << "]";
        if (!target.links.empty()) {
            std::cout << " -> ";
            for (std::size_t i = 0; i < target.links.size(); ++i) {
                if (i) std::cout << ", ";
                std::cout << target.links[i];
            }
        }
        std::cout << '\n';
    }
}
