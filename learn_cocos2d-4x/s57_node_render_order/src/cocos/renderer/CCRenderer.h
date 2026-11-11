#pragma once

#include "backend/CCCommandBuffer.h"

#include <string>
#include <vector>

namespace cocos2d {
class Renderer {
public:
    explicit Renderer(backend::CommandBuffer& commandBuffer) : _commandBuffer(commandBuffer) {}
    void addCommand(const std::string& nodeName, float globalZOrder);
    void render();

private:
    struct Command {
        std::string nodeName;
        float globalZOrder;
        unsigned int arrival;
    };
    backend::CommandBuffer& _commandBuffer;
    unsigned int _nextArrival = 0;
    std::vector<Command> _globalNegative;
    std::vector<Command> _globalZero;
    std::vector<Command> _globalPositive;
};
}
