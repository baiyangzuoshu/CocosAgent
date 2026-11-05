#pragma once

#include <string>
#include <vector>

namespace cocos2d {
class Renderer {
public:
    void addCommand(const std::string& owner) { _commands.push_back(owner); }
    void clear() { _commands.clear(); }
    void render();

private:
    std::vector<std::string> _commands;
};
} // namespace cocos2d
