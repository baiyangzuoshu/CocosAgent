#include "resource/ResourceLayout.h"

#include <iostream>

int main() {
    const std::string sourceFile = "HelloWorld/Resources/HelloWorld.png";
    const std::string runtimeRoot = "../Resources/";
    const std::string requestedName = "HelloWorld.png";

    std::cout << "source=" << sourceFile << '\n'
              << "runtime=" << lesson::resolveFromResourceRoot(runtimeRoot, requestedName) << '\n';
}
