#pragma once

#include "backend/CCCommandBuffer.h"

namespace cocos2d {
class Renderer {
public:
    explicit Renderer(backend::CommandBuffer& commandBuffer)
        : _commandBuffer(commandBuffer) {}
    void setViewPort(int x, int y, unsigned int width, unsigned int height);
    void addTrianglesCommand(const char* cameraName);
    void render();

private:
    backend::CommandBuffer& _commandBuffer;
    int _x = 0;
    int _y = 0;
    unsigned int _width = 0;
    unsigned int _height = 0;
    const char* _cameraName = "";
};
}
