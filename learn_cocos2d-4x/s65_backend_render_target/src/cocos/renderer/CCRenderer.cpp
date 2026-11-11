#include "CCRenderer.h"

#include <iostream>

Renderer::Renderer(CommandBuffer& commandBuffer)
    : _commandBuffer(commandBuffer), _currentQueue(&_mainQueue) {}

void Renderer::setRenderTarget(const char* color, const char* depthStencil) {
    _oldDescriptor = _descriptor;
    _descriptor.colorAttachment = color ? color : "";
    _descriptor.depthStencilAttachment = depthStencil ? depthStencil : "";
    std::cout << "Renderer.setRenderTarget -> update RenderPassDescriptor\n";
}

void Renderer::beginRenderPass() {
    _commandBuffer.beginRenderPass(_descriptor);
}

void Renderer::drawScene() {
    _commandBuffer.drawScene();
}

void Renderer::endRenderPass() {
    _commandBuffer.endRenderPass();
}

void Renderer::restoreRenderTarget() {
    _descriptor = _oldDescriptor;
    std::cout << "Renderer restores previous render target descriptor\n";
}

void Renderer::addCallback(const char* name, std::function<void()> callback) {
    _currentQueue->push_back([name, callback]() {
        std::cout << "Renderer executes CallbackCommand " << name << "\n";
        callback();
    });
}

void Renderer::beginGroup() {
    _groupQueue = std::make_shared<std::vector<std::function<void()>>>();
    const auto group = _groupQueue;
    _mainQueue.push_back([group]() {
        std::cout << "Renderer.processGroupCommand\n";
        for (const auto& command : *group) command();
    });
    _currentQueue = _groupQueue.get();
    std::cout << "Renderer.add GroupCommand and pushGroup\n";
}

void Renderer::addSceneDraw() {
    _currentQueue->push_back([this]() {
        beginRenderPass();
        drawScene();
        endRenderPass();
    });
}

void Renderer::endGroup() {
    _currentQueue = &_mainQueue;
    std::cout << "Renderer.popGroup\n";
}

void Renderer::render() {
    std::cout << "Renderer.render -> process main queue\n";
    for (const auto& command : _mainQueue) command();
    _mainQueue.clear();
    _groupQueue.reset();
}
