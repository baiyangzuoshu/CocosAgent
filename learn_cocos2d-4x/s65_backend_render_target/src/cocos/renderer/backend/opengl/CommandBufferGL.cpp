#include "CommandBufferGL.h"

#include <iostream>

void CommandBufferGL::beginRenderPass(const RenderPassDescriptor& descriptor) {
    std::cout << "CommandBufferGL.beginRenderPass -> bind generated FBO\n";
    std::cout << "attach color texture " << descriptor.colorAttachment << "\n";
    if (!descriptor.depthStencilAttachment.empty()) {
        std::cout << "attach depth/stencil " << descriptor.depthStencilAttachment << "\n";
    }
}

void CommandBufferGL::drawScene() {
    std::cout << "CommandBufferGL draws scene into current FBO\n";
}

void CommandBufferGL::endRenderPass() {
    std::cout << "CommandBufferGL.endRenderPass\n";
}
