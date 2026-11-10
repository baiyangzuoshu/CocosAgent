#include <array>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

namespace fs = std::filesystem;

std::string findLineContaining(const fs::path& file, const std::string& token)
{
    std::ifstream input(file);
    std::string line;
    while (std::getline(input, line))
    {
        if (line.find(token) != std::string::npos)
            return line;
    }
    return "not found";
}

int main(int argc, char** argv)
{
    const fs::path engineRoot = argc > 1
        ? fs::path(argv[1])
        : fs::path("../../engine/cocos2d-x-4");

    if (!fs::is_directory(engineRoot))
    {
        std::cerr << "Engine directory not found: " << engineRoot << '\n'
                  << "Pass the path to engine/cocos2d-x-4 as the first argument.\n";
        return 1;
    }

    std::cout << "Source root: " << fs::absolute(engineRoot).lexically_normal() << '\n';
    std::cout << "Release marker: "
              << findLineContaining(engineRoot / "CHANGELOG", "cocos2d-x-4.0") << '\n';
    std::cout << "Version macro: "
              << findLineContaining(engineRoot / "cocos/cocos2d.h", "COCOS2D_VERSION") << '\n';

    const std::array<const char*, 7> directories{
        "cocos", "extensions", "external", "tests", "templates", "tools", "docs"};
    std::cout << "Directory map:\n";
    for (const char* name : directories)
    {
        const fs::path path = engineRoot / name;
        std::cout << "  " << name << ": "
                  << (fs::is_directory(path) ? "present" : "missing") << '\n';
    }
}
