#include "CCRenderer.h"

#include <algorithm>
#include <iostream>

namespace cocos2d {
void Renderer::addCommand(const std::string& nodeName, float globalZOrder) {
    Command command{nodeName, globalZOrder, _nextArrival++};
    if (globalZOrder < 0) _globalNegative.push_back(command);
    else if (globalZOrder > 0) _globalPositive.push_back(command);
    else _globalZero.push_back(command);
}

void Renderer::render() {
    const auto compareGlobal = [](const Command& a, const Command& b) {
        if (a.globalZOrder != b.globalZOrder) return a.globalZOrder < b.globalZOrder;
        return a.arrival < b.arrival;
    };
    std::stable_sort(_globalNegative.begin(), _globalNegative.end(), compareGlobal);
    std::stable_sort(_globalPositive.begin(), _globalPositive.end(), compareGlobal);

    std::cout << "Renderer::render -> sort render groups\n";
    _commandBuffer.beginFrame();
    for (const Command& command : _globalNegative) _commandBuffer.draw(command.nodeName);
    for (const Command& command : _globalZero) _commandBuffer.draw(command.nodeName);
    for (const Command& command : _globalPositive) _commandBuffer.draw(command.nodeName);
    _commandBuffer.endFrame();
    _globalNegative.clear();
    _globalZero.clear();
    _globalPositive.clear();
    _nextArrival = 0;
}
}
