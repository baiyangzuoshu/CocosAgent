#pragma once

#include "backend/CommandBuffer.h"

#include <functional>
#include <memory>
#include <vector>

class Renderer {
public:
    explicit Renderer(CommandBuffer& commandBuffer);
    void setRenderTarget(const char* color, const char* depthStencil);
    void beginRenderPass();
    void drawScene();
    void endRenderPass();
    void restoreRenderTarget();
    void beginGroup();
    void addCallback(const char* name, std::function<void()> callback);
    void addSceneDraw();
    void endGroup();
    void render();

private:
    CommandBuffer& _commandBuffer;
    RenderPassDescriptor _descriptor;
    RenderPassDescriptor _oldDescriptor;
    std::vector<std::function<void()>> _mainQueue;
    std::shared_ptr<std::vector<std::function<void()>>> _groupQueue;
    std::vector<std::function<void()>>* _currentQueue;
};
