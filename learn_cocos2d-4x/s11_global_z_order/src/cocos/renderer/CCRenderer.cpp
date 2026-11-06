#include "CCRenderer.h"
#include <algorithm>
#include <iostream>

namespace cocos2d {
void Renderer::addCommand(const std::string& owner, float globalOrder) {
    std::cout << "visit " << owner << " (globalZ=" << globalOrder << ")\n";
    _commands.push_back({ owner, globalOrder });
}

void Renderer::render() {
    std::stable_sort(_commands.begin(), _commands.end(), [](const Command& left, const Command& right) {
        return left.globalOrder < right.globalOrder;
    });
    std::cout << "Renderer::render submits " << _commands.size() << " command(s)\n";
    for (const Command& command : _commands) std::cout << "submit " << command.owner << " (globalZ=" << command.globalOrder << ")\n";
    clear();
}
} // namespace cocos2d
