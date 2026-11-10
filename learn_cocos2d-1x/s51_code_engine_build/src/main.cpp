#include "build/BuildGraph.h"

#include <iostream>

int main() {
    std::cout << "Cocos2d-x 1.x Make build graph (Linux)\n";
    for (const lesson::BuildStep& step : lesson::linuxBuildGraph()) {
        std::cout << step.target << " -> " << step.output << " <- ";
        for (std::size_t i = 0; i < step.prerequisites.size(); ++i) {
            if (i) std::cout << ", ";
            std::cout << step.prerequisites[i];
        }
        std::cout << '\n';
    }
}
