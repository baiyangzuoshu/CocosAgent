#include "CCRenderer.h"
#include <iostream>

namespace cocos2d {
void Renderer::render() {
    std::cout << "Renderer::render submits " << _commands.size() << " command(s)\n";
    for (const std::string& owner : _commands) std::cout << "submit " << owner << "\n";
    clear();
}
} // namespace cocos2d
