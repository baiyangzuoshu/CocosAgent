#pragma once

#include <iostream>

namespace cocos2d {
namespace backend {
class CommandBuffer {
public:
    void setViewport(int x, int y, unsigned int width, unsigned int height) {
        std::cout << "CommandBuffer::setViewport(" << x << ", " << y << ", "
                  << width << ", " << height << ")\n";
    }
};
}
}
