#pragma once

#include "CCTrianglesCommand.h"
#include <string>
#include <vector>

namespace cocos2d {
class Renderer {
public:
    struct Command {
        std::string owner;
        float globalOrder;
        TrianglesCommand triangles;
    };

    void addCommand(const std::string& owner, float globalOrder);
    void addCommand(const std::string& owner, float globalOrder, const TrianglesCommand& triangles);
    void clear() { _commands.clear(); }
    void render();

private:
    std::vector<Command> _commands;
};
} // namespace cocos2d
