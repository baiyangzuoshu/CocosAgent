#include "resource/ResourceSearch.h"

#include <iostream>

int main() {
    const std::vector<std::string> searchPaths = {"Resources-HD", "Resources"};
    const std::vector<std::string> packagedFiles = {"Resources/HelloWorld.png"};
    std::cout << lesson::firstExistingPath("HelloWorld.png", searchPaths, packagedFiles) << '\n';
}
