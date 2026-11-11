#include "CCRenderer.h"

#include <iostream>

Renderer::Renderer(CommandBuffer* commandBuffer) : _commandBuffer(commandBuffer) {}

void Renderer::render(MeshCommand* command) {
    _commandBuffer->beginFrame();
    std::cout << "Renderer.render -> sort and visit command queue\n";
    std::cout << "Renderer.processRenderCommand(MESH_COMMAND)\n";
    drawMeshCommand(command);
    _commandBuffer->endFrame();
}

void Renderer::drawMeshCommand(MeshCommand* command) {
    std::cout << "Renderer.drawMeshCommand -> drawCustomCommand\n";
    drawCustomCommand(command);
}

void Renderer::drawCustomCommand(MeshCommand* command) {
    _commandBuffer->beginRenderPass();
    _commandBuffer->setProgramState(command->program);
    _commandBuffer->setVertexBuffer(command->vertexBuffer);
    _commandBuffer->setIndexBuffer(command->indexBuffer);
    _commandBuffer->drawElements(command->indexCount);
    _commandBuffer->endRenderPass();
}
