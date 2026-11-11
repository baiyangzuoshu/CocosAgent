#pragma once

#include <iostream>
#include <string>

namespace cocos2d {
namespace backend {
class CommandBuffer {
public:
    void beginFrame() { std::cout << "CommandBuffer.beginFrame\n"; }
    void draw(const std::string& nodeName) { std::cout << "CommandBuffer.draw(" << nodeName << ")\n"; }
    void endFrame() { std::cout << "CommandBuffer.endFrame\n"; }
};
}
}
