#include "CCRenderer.h"

#include <iostream>

namespace cocos2d {
void Renderer::setViewPort(int x, int y, unsigned int width, unsigned int height) {
    _x = x;
    _y = y;
    _width = width;
    _height = height;
    std::cout << "Renderer::setViewPort -> store render-pass viewport\n";
}

void Renderer::addTrianglesCommand(const char* cameraName) {
    _cameraName = cameraName;
    std::cout << "Renderer.queue(TrianglesCommand, camera=" << cameraName << ")\n";
}

void Renderer::render() {
    std::cout << "Renderer::beginRenderPass(camera=" << _cameraName << ")\n";
    _commandBuffer.setViewport(_x, _y, _width, _height);
    std::cout << "Renderer executes queued command through backend\n";
}
}
